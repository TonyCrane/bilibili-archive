#!/usr/bin/env python3
"""
Bilibili 视频信息 / 评论区存档工具（仅依赖 Python 标准库）。

存档目录结构（默认 ./archive）::

    archive/<BV号>/
        video.json        视频信息（view/detail 接口：稿件、UP 主卡片、标签）+ 数据快照
        comments.json     全部评论（API 原始对象，楼中楼完整），多次抓取会合并
        media/cover.*     视频封面
        media/pics/*      评论中的图片
        media/emotes/*    评论中的表情
        danmaku.json      弹幕（可选，collect/update 加 --danmaku 或使用 danmaku 子命令）

常用命令::

    # 抓取（或更新）指定视频的全部信息：视频信息 + 评论 + 本地图片
    python collector/bili_archive.py collect BVxxxxxxxxxx BVyyyyyyyyyy --cookie-file cookie.txt

    # 更新存档中已有的全部视频
    python collector/bili_archive.py update --cookie-file cookie.txt

    # 同时导出弹幕；只导出弹幕
    python collector/bili_archive.py collect BVxxxxxxxxxx --danmaku
    python collector/bili_archive.py danmaku

    # 只刷新视频信息 / 只补全缺失的图片（无需登录）
    python collector/bili_archive.py video BVxxxxxxxxxx
    python collector/bili_archive.py media

Cookie 可以通过 --cookie "SESSDATA=...; bili_jct=..."、--cookie-file 或环境变量 BILI_COOKIE 提供，
抓取评论区时必须登录（未登录时 B 站只返回极少量评论）。
被锁定 / 下线的稿件无法通过公开接口获取，如果登录账号是该稿件的 UP 主，会自动改用创作中心接口抓取视频信息和评论。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')
ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ARCHIVE = ROOT_DIR / 'archive'
BV_RE = re.compile(r'^BV[0-9A-Za-z]{10}$')

MIXIN_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
             33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
             61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
             36, 20, 34, 44, 52]


def log(*args):
    print(*args, flush=True)


def now_str():
    return time.strftime('%Y-%m-%d %H:%M:%S')


def read_json(path: Path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def write_json(path: Path, data, indent=1):
    """原子写入，避免中断时留下半个文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, path)


# ---------------------------------------------------------------- 规范化与变更检测
#
# B 站接口每次返回的部分字段会随机变化（与内容无关）：图片 CDN 域名 i0/i1/i2 轮换、
# 搜索链接中的 seid 与 A/B 实验参数、相对时间「3天前发布」、大会员标签图片（两套随机返回）等。
# 保存前统一规范化，这样内容没有变化时文件也不会变化，可以直接判断「未修改」。

_HDSLB_RE = re.compile(r'^(?:https?:)?//i\d\.hdslb\.com/')
_TRACKING_RE = re.compile(r'([?&])(?:seid|search_half_screen|half_screen_page_type|scroll_to_fullscreen)=[^&]*&?')
_VOLATILE_KEYS = {'time_desc', 'img_label_uri_hans', 'img_label_uri_hant',
                  'img_label_uri_hans_static', 'img_label_uri_hant_static'}


def canonical(o):
    if isinstance(o, dict):
        return {k: canonical(v) for k, v in o.items() if k not in _VOLATILE_KEYS}
    if isinstance(o, list):
        return [canonical(v) for v in o]
    if isinstance(o, str):
        if 'hdslb.com/' in o:
            o = _HDSLB_RE.sub('https://i0.hdslb.com/', o)
        if 'search' in o and '?' in o:
            prev = None
            while prev != o:
                prev, o = o, _TRACKING_RE.sub(lambda m: m.group(1), o)
            o = o.rstrip('?&')
        return o
    return o


# UP 主账号层面的计数（总获赞、粉丝数等）随时在变，与视频本身无关，不作为「有变化」的依据
_CARD_COUNTERS = {'like_num', 'follower', 'archive_count', 'article_count'}
_CARD_INNER_COUNTERS = {'fans', 'friend', 'attention'}
# 数据快照比较的字段（即网页上展示的数据）
SNAPSHOT_FIELDS = ('view', 'danmaku', 'reply', 'favorite', 'coin', 'share', 'like')


def _video_for_compare(v: dict) -> dict:
    v = dict(v)
    card = {k: x for k, x in (v.get('card') or {}).items() if k not in _CARD_COUNTERS}
    if isinstance(card.get('card'), dict):
        card['card'] = {k: x for k, x in card['card'].items() if k not in _CARD_INNER_COUNTERS}
    v['card'] = card
    return v


def same(a: dict | None, b: dict | None, ignore=()) -> bool:
    """比较两份存档数据（忽略抓取时间等元信息字段）。"""
    if a is None or b is None:
        return False
    strip = lambda d: {k: v for k, v in d.items() if k not in ignore}
    return canonical(strip(a)) == canonical(strip(b))


# ---------------------------------------------------------------- HTTP client

class ApiError(Exception):
    def __init__(self, code, message):
        super().__init__(f'{code} {message}')
        self.code = code
        self.message = message


class Client:
    def __init__(self, cookie: str = ''):
        self.cookies: dict[str, str] = {}
        for part in cookie.split(';'):
            if '=' in part:
                k, v = part.split('=', 1)
                self.cookies[k.strip()] = v.strip()
        self._mixin_key = None
        self.nav = None

    @property
    def logged_in(self):
        return bool(self.nav and self.nav.get('isLogin'))

    def _headers(self, referer):
        h = {'User-Agent': UA, 'Referer': referer or 'https://www.bilibili.com/',
             'Origin': 'https://www.bilibili.com', 'Accept': 'application/json, text/plain, */*'}
        if self.cookies:
            h['Cookie'] = '; '.join(f'{k}={v}' for k, v in self.cookies.items())
        return h

    def raw_get(self, url, referer=None, timeout=30):
        req = urllib.request.Request(url, headers=self._headers(referer))
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()

    def get(self, url, params=None, *, wbi=False, referer=None, retries=6, ok_codes=(0,)):
        """GET 一个 JSON 接口，返回 data 字段；风控 / 网络错误自动重试。"""
        last_err = None
        for attempt in range(retries):
            p = dict(params or {})
            if wbi:
                p = self.wbi_sign(p)
            full = url + ('?' + urllib.parse.urlencode(p) if p else '')
            try:
                body = json.loads(self.raw_get(full, referer))
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError) as e:
                last_err = e
                time.sleep(1.5 + attempt * 1.5)
                continue
            code = body.get('code')
            if code in ok_codes:
                return body.get('data')
            if code in (-352, -412, -509, -799):  # 风控 / 请求过快
                last_err = ApiError(code, body.get('message'))
                time.sleep(3 + attempt * 3 + random.random() * 2)
                continue
            raise ApiError(code, body.get('message'))
        raise last_err or ApiError(-1, 'request failed')

    def init(self):
        if 'buvid3' not in self.cookies:
            try:
                spi = self.get('https://api.bilibili.com/x/frontend/finger/spi')
                self.cookies['buvid3'] = spi['b_3']
                self.cookies['buvid4'] = spi['b_4']
            except Exception as e:  # noqa: BLE001 - buvid 只是降低风控概率，不是必须
                log(f'  (获取 buvid 失败：{e})')
        self.nav = self.get('https://api.bilibili.com/x/web-interface/nav', ok_codes=(0, -101))
        return self

    def mixin_key(self):
        if self._mixin_key is None:
            wbi = (self.nav or {}).get('wbi_img') or {}
            raw = ''.join(u.rsplit('/', 1)[-1].split('.')[0] for u in (wbi.get('img_url', ''), wbi.get('sub_url', '')))
            self._mixin_key = ''.join(raw[i] for i in MIXIN_TAB if i < len(raw))[:32]
        return self._mixin_key

    def wbi_sign(self, params):
        params = dict(params, wts=int(time.time()))
        params = {k: re.sub(r"[!'()*]", '', str(v)) for k, v in sorted(params.items())}
        query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
        params['w_rid'] = hashlib.md5((query + self.mixin_key()).encode()).hexdigest()
        return params


# ---------------------------------------------------------------- video info

def fetch_video(client: Client, bvid: str, vdir: Path):
    """抓取视频信息并与已有存档合并。

    公开接口不可用（视频被锁定 / 下线 / 仅自己可见）时，若登录账号是 UP 主本人，改用创作中心接口获取；
    仍然失败则保留已有存档信息，仅记录失效状态。
    """
    old = read_json(vdir / 'video.json', {}) or {}
    referer = f'https://www.bilibili.com/video/{bvid}/'
    status = {'checked_at': now_str()}
    try:
        detail = client.get('https://api.bilibili.com/x/web-interface/view/detail', {'bvid': bvid}, referer=referer)
        view = detail['View']
        card = detail.get('Card') or {}
        tags = detail.get('Tags')
        status.update(ok=True, code=0, message='OK')
    except ApiError as e:
        member = fetch_video_member(client, bvid, old) if client.logged_in else None
        if member:
            view, card, tags, status = member
            status.update(checked_at=now_str(), public_code=e.code, public_message=e.message)
            log(f'  公开接口不可用（{e.code} {e.message}），已通过创作中心获取：{status["message"]}')
        elif old:
            log(f'  !! 视频信息获取失败（{e.code} {e.message}），保留已有存档信息')
            new_status = dict(old.get('status') or {}, **status, ok=False, code=e.code, message=e.message)
            if not same(old.get('status') or {}, new_status, ignore=('checked_at',)):
                old['status'] = new_status
                write_json(vdir / 'video.json', old)
            return old
        else:
            # view/detail 偶尔不可用，退回 view 接口
            view = client.get('https://api.bilibili.com/x/web-interface/view', {'bvid': bvid}, referer=referer)
            card, tags = {}, None
            status.update(ok=True, code=0, message='OK')

    view, card, tags = canonical(view), canonical(card or old.get('card') or {}), canonical(tags)
    # 数据快照只在播放量等数据变化时追加
    snapshots = list(old.get('snapshots') or [])
    stat = view.get('stat')
    pick = lambda st: {k: (st or {}).get(k) for k in SNAPSHOT_FIELDS}
    if stat and (not snapshots or pick(snapshots[-1].get('stat')) != pick(stat)):
        snapshots.append({'time': now_str(), 'stat': stat})
    video = {
        'bvid': view.get('bvid', bvid),
        'aid': view.get('aid'),
        'fetched_at': now_str(),
        'first_archived_at': old.get('first_archived_at') or now_str(),
        'status': status,
        'view': view,
        'card': card,
        'tags': tags if tags is not None else old.get('tags') or [],
        'snapshots': snapshots,
    }
    st = view.get('stat') or {}
    old_status = {k: v for k, v in (old.get('status') or {}).items() if k != 'checked_at'}
    new_status = {k: v for k, v in status.items() if k != 'checked_at'}
    if old and old_status == new_status and same(_video_for_compare(old), _video_for_compare(video),
                                                 ignore=('fetched_at', 'status')):
        log(f'  视频：{view.get("title")}  信息无变化')
        return old
    write_json(vdir / 'video.json', video)
    log(f'  视频：{view.get("title")}  播放 {st.get("view", "-")}  评论 {st.get("reply", "-")}'
        + ('（新增数据快照）' if len(snapshots) > len(old.get('snapshots') or []) else ''))
    return video


def fetch_video_member(client: Client, bvid: str, old: dict):
    """通过创作中心接口获取自己的稿件信息（被锁定 / 下线的稿件也可以），转换成与公开接口相近的结构。"""
    try:
        data = client.get('https://member.bilibili.com/x/vupre/web/archive/view', {'bvid': bvid},
                          referer='https://member.bilibili.com/platform/upload-manager/article')
    except ApiError:
        return None
    arc = (data or {}).get('archive') or {}
    if not arc.get('aid'):
        return None
    videos = (data or {}).get('videos') or []
    nav = client.nav or {}
    owner = {'mid': arc.get('mid'), 'name': arc.get('author') or '', 'face': ''}
    card = {}
    try:
        card = client.get('https://api.bilibili.com/x/web-interface/card', {'mid': arc.get('mid'), 'photo': 'false'}) or {}
        cc = card.get('card') or {}
        owner.update(name=owner['name'] or cc.get('name', ''), face=cc.get('face', ''))
    except ApiError:
        if nav.get('mid') == arc.get('mid'):
            owner.update(name=owner['name'] or nav.get('uname', ''), face=nav.get('face', ''))
    # 创作中心的稿件数据（锁定后不再变化，即锁定时的数据）
    stat = None
    try:
        d = client.get('https://member.bilibili.com/x/web/data/archive', {'bvid': bvid},
                       referer='https://member.bilibili.com/platform/data/archive') or {}
        st = d.get('stat') or {}
        if st:
            stat = {'aid': arc.get('aid'), 'view': st.get('play', 0), 'danmaku': st.get('dm', 0),
                    'reply': st.get('reply', 0), 'favorite': st.get('fav', 0), 'coin': st.get('coin', 0),
                    'share': st.get('share', 0), 'like': st.get('like', 0)}
    except ApiError as e:
        log(f'  (创作中心稿件数据获取失败：{e})')
    if stat is not None and not stat['reply']:
        # 较早的稿件在稿件数据接口中评论数恒为 0，改用「评论管理」接口的评论总数
        try:
            page = (client.get('https://api.bilibili.com/x/v2/reply/up/fulllist',
                               {'order': 0, 'filter': -1, 'type': 1, 'bvid': bvid, 'pn': 1, 'ps': 1},
                               referer='https://member.bilibili.com/platform/comment/article') or {}).get('page') or {}
            stat['reply'] = page.get('total') or 0
        except ApiError as e:
            log(f'  (评论总数获取失败：{e})')
    view = dict(old.get('view') or {})
    # 分区信息对失效稿件没有意义，不保留
    for k in ('tid', 'tid_v2', 'tname', 'tname_v2'):
        view.pop(k, None)
    view.update({
        'bvid': arc.get('bvid', bvid),
        'aid': arc.get('aid'),
        'title': arc.get('title', ''),
        'pic': arc.get('cover', ''),
        'desc': arc.get('desc', ''),
        'dynamic': arc.get('dynamic', ''),
        'duration': arc.get('duration', 0),
        'pubdate': arc.get('ptime') or arc.get('ctime'),
        'ctime': arc.get('ctime'),
        'copyright': arc.get('copyright', 1),
        'owner': owner,
        'rights': dict(view.get('rights') or {}, no_reprint=arc.get('no_reprint', 0)),
        'cid': videos[0]['cid'] if videos else view.get('cid'),
        'pages': [{'cid': v.get('cid'), 'page': v.get('index'), 'part': v.get('title') or arc.get('title', ''),
                   'duration': v.get('duration', 0)} for v in videos] or view.get('pages') or [],
    })
    if stat:
        view['stat'] = stat
    if not view.get('desc_v2'):
        view['desc_v2'] = [{'raw_text': arc.get('desc', ''), 'type': 1, 'biz_id': 0}]
    tags = [{'tag_name': t, 'tag_type': 'old_channel', 'jump_url': ''} for t in (arc.get('tag') or '').split(',') if t]
    status = {
        'ok': False, 'source': 'member',
        'code': arc.get('state'), 'message': arc.get('state_desc') or '不可见',
        'reason': arc.get('reject_reason') or '',
    }
    return view, card, tags or None, status


# ---------------------------------------------------------------- comments

def fetch_main_pages(client: Client, aid: int, mode: int, referer: str):
    """按 mode（3=热门, 2=最新）翻完全部主评论。返回 (replies, top_replies, upper_mid, all_count, complete)."""
    replies, tops, upper, all_count = [], [], None, None
    offset, page = '', 0
    complete = False
    while True:
        params = {'oid': aid, 'type': 1, 'mode': mode, 'plat': 1, 'web_location': 1315875,
                  'pagination_str': json.dumps({'offset': offset}, separators=(',', ':'))}
        if page == 0:
            params['seek_rpid'] = ''
        try:
            data = client.get('https://api.bilibili.com/x/v2/reply/wbi/main', params, wbi=True, referer=referer)
        except ApiError as e:
            log(f'    !! 第 {page} 页失败：{e}')
            break
        cur = data.get('cursor') or {}
        reps = data.get('replies') or []
        if page == 0:
            tops = data.get('top_replies') or []
            upper = ((data.get('upper') or {}).get('mid'))
            all_count = cur.get('all_count')
        replies.extend(reps)
        page += 1
        offset = ((cur.get('pagination_reply') or {}).get('next_offset')) or ''
        if cur.get('is_end') or not reps or not offset:
            complete = True
            break
        time.sleep(0.35 + random.random() * 0.3)
    return replies, tops, upper, all_count, complete


def fetch_sub_replies(client: Client, aid: int, root_rpid: int, referer: str):
    subs, seen, pn = [], set(), 1
    while True:
        try:
            data = client.get('https://api.bilibili.com/x/v2/reply/reply',
                              {'oid': aid, 'type': 1, 'root': root_rpid, 'ps': 20, 'pn': pn}, referer=referer)
        except ApiError as e:
            if e.code in (12022, -404):  # 根评论已被删除
                return subs, True
            log(f'    !! 楼中楼 {root_rpid} 第 {pn} 页失败：{e}')
            return subs, False
        reps = (data or {}).get('replies') or []
        count = ((data or {}).get('page') or {}).get('count', 0)
        for r in reps:
            if r['rpid'] not in seen:
                seen.add(r['rpid'])
                subs.append(r)
        if not reps or len(seen) >= count or pn >= 500:
            return subs, True
        pn += 1
        time.sleep(0.25 + random.random() * 0.2)


def merge_comments(old: dict | None, new: dict) -> dict:
    """把新抓取的评论与已有存档合并：保留已被删除的评论（标记 _gone_since），更新仍存在评论的数据。"""
    if not old:
        return new
    complete = new['crawls'][-1]['complete']
    stamp = new['crawls'][-1]['time']
    new_by = {r['rpid']: r for r in new['roots']}
    old_by = {r['rpid']: r for r in old.get('roots') or []}

    def merge_subs(new_root, old_root):
        nsubs = {s['rpid']: s for s in new_root.get('replies') or []}
        for s in old_root.get('replies') or []:
            if s['rpid'] not in nsubs:
                s = dict(s)
                if complete and new_root.get('_sub_complete') and not s.get('_gone_since'):
                    s['_gone_since'] = stamp
                nsubs[s['rpid']] = s
        new_root['replies'] = sorted(nsubs.values(), key=lambda r: (r.get('ctime', 0), r['rpid']))

    roots = []
    for rpid, r in new_by.items():
        if rpid in old_by:
            merge_subs(r, old_by[rpid])
        roots.append(r)
    gone = []
    for rpid, r in old_by.items():
        if rpid not in new_by:
            r = dict(r)
            if complete and not r.get('_gone_since'):
                r['_gone_since'] = stamp
            roots.append(r)
            gone.append(rpid)
    merged = dict(new)
    merged['roots'] = roots
    merged['order_hot'] = new['order_hot'] + [i for i in gone if i not in set(new['order_hot'])]
    merged['order_time'] = new['order_time'] + [i for i in gone if i not in set(new['order_time'])]
    merged['crawls'] = (old.get('crawls') or []) + new['crawls']
    merged['first_archived_at'] = old.get('first_archived_at') or new.get('first_archived_at')
    return merged


def fetch_comments(client: Client, bvid: str, video: dict, vdir: Path):
    view = video['view']
    aid = view['aid']
    referer = f'https://www.bilibili.com/video/{bvid}/'
    roots: dict[int, dict] = {}
    order = {'hot': [], 'time': []}
    tops, upper_mid, all_count, complete = [], None, None, True

    for mode, key in ((3, 'hot'), (2, 'time')):
        reps, t, up, cnt, ok = fetch_main_pages(client, aid, mode, referer)
        complete &= ok
        if key == 'hot':
            tops, upper_mid, all_count = t, up, cnt
        for r in reps:
            if r['rpid'] not in order[key]:
                order[key].append(r['rpid'])
            prev = roots.get(r['rpid'])
            r = dict(r)
            r['_preview'] = [s['rpid'] for s in (r.get('replies') or [])]
            if prev is None or (r.get('rcount') or 0) >= (prev.get('rcount') or 0):
                if prev and prev.get('_preview') and not r['_preview']:
                    r['_preview'] = prev['_preview']
                roots[r['rpid']] = r
        log(f'    {key}: {len(reps)} 条主评论（{"完整" if ok else "不完整"}）')

    for t in tops:
        t = dict(t)
        t['_is_top'] = 'upper'
        t['_preview'] = [s['rpid'] for s in (t.get('replies') or [])]
        roots[t['rpid']] = t
        for key in order:
            if t['rpid'] in order[key]:
                order[key].remove(t['rpid'])
            order[key].insert(0, t['rpid'])

    log(f'    主评论共 {len(roots)} 条，开始抓取楼中楼…')
    done = 0
    for rpid, root in roots.items():
        inline = root.get('replies') or []
        rcount = root.get('rcount') or 0
        if rcount > len(inline):
            subs, ok = fetch_sub_replies(client, aid, rpid, referer)
            have = {s['rpid'] for s in subs}
            subs += [s for s in inline if s['rpid'] not in have]
        else:
            subs, ok = list(inline), True
        root['replies'] = sorted(subs, key=lambda r: (r.get('ctime', 0), r['rpid']))
        root['_sub_complete'] = ok
        complete &= ok
        done += 1
        if done % 50 == 0:
            log(f'    … {done}/{len(roots)}')

    n_sub = sum(len(r['replies']) for r in roots.values())
    stamp = now_str()
    new = {
        'bvid': bvid, 'aid': aid, 'upper_mid': upper_mid or (view.get('owner') or {}).get('mid'),
        'first_archived_at': stamp,
        'crawl_time': stamp,
        'all_count': all_count,
        'order_hot': order['hot'], 'order_time': order['time'],
        'crawls': [{'time': stamp, 'roots': len(roots), 'subs': n_sub, 'all_count': all_count, 'complete': complete}],
        'roots': list(roots.values()),
    }
    old = read_json(vdir / 'comments.json')
    merged = canonical(merge_comments(old, new))
    if same(old, merged, ignore=('crawl_time', 'crawls', 'first_archived_at')):
        log(f'  评论：{len(roots)} 主评论 + {n_sub} 楼中楼，无变化')
        return old
    write_json(vdir / 'comments.json', merged)
    gone = sum(1 for r in merged['roots'] if r.get('_gone_since'))
    log(f'  评论：{len(roots)} 主评论 + {n_sub} 楼中楼（站点计数 {all_count}）'
        + (f'，存档中另有 {gone} 条已删除的主评论' if gone else '')
        + ('' if complete else '  [本次抓取不完整，可稍后重试]'))
    return merged


def fetch_comments_member(client: Client, bvid: str, video: dict, vdir: Path):
    """通过创作中心「评论管理」接口抓取自己稿件的全部评论（适用于被锁定 / 下线的稿件）。

    该接口按时间返回主评论与楼中楼混合的评论流，这里重新组装成与公开接口一致的结构。
    """
    aid = video['view']['aid']
    referer = 'https://member.bilibili.com/platform/comment/article'
    url = 'https://api.bilibili.com/x/v2/reply/up/fulllist'
    items: dict[int, dict] = {}
    pn, total, complete = 1, None, True
    while True:
        try:
            data = client.get(url, {'order': 0, 'filter': -1, 'type': 1, 'bvid': bvid, 'pn': pn, 'ps': 49}, referer=referer)
        except ApiError as e:
            log(f'    !! 第 {pn} 页失败：{e}')
            complete = False
            break
        page = (data or {}).get('page') or {}
        total = page.get('total', total)
        got = (data or {}).get('list') or []
        for r in got:
            items[r['rpid']] = r
        if not got or pn * 49 >= (total or 0):
            break
        pn += 1
        if pn % 10 == 0:
            log(f'    … 第 {pn} 页，已获取 {len(items)} 条')
        time.sleep(0.35 + random.random() * 0.2)

    roots = {k: dict(v) for k, v in items.items() if not v.get('root')}
    subs = [v for v in items.values() if v.get('root')]
    by_root: dict[int, list] = {}
    for sub in subs:
        by_root.setdefault(sub['root'], []).append(sub)
    for rpid, r in roots.items():
        have = {x['rpid']: x for x in (r.get('replies') or [])}
        for sub in by_root.get(rpid, []):
            have[sub['rpid']] = sub
        r['replies'] = sorted(have.values(), key=lambda x: (x.get('ctime', 0), x['rpid']))
        r['_preview'] = [x['rpid'] for x in r['replies'][:3]]
        r['_sub_complete'] = len(r['replies']) >= (r.get('rcount') or 0)
    # 主评论已被删除的楼中楼，单独作为一层保留
    for sub in subs:
        if sub['root'] not in roots:
            o = dict(sub, _orphan_sub=True, replies=[])
            roots[o['rpid']] = o

    n_sub = sum(len(r['replies']) for r in roots.values())
    stamp = now_str()
    vals = list(roots.values())
    new = {
        'bvid': bvid, 'aid': aid, 'upper_mid': (video['view'].get('owner') or {}).get('mid'),
        'first_archived_at': stamp, 'crawl_time': stamp, 'all_count': total,
        'order_hot': [r['rpid'] for r in sorted(vals, key=lambda r: (-r.get('like', 0), -r.get('ctime', 0)))],
        'order_time': [r['rpid'] for r in sorted(vals, key=lambda r: -r.get('ctime', 0))],
        'crawls': [{'time': stamp, 'roots': len(roots), 'subs': n_sub, 'all_count': total,
                    'complete': complete, 'source': 'member-fulllist'}],
        'roots': vals,
    }
    old = read_json(vdir / 'comments.json')
    merged = merge_comments(old, new)
    resolve_emotes(client, merged, vdir.parent)
    merged = canonical(merged)
    if same(old, merged, ignore=('crawl_time', 'crawls', 'first_archived_at')):
        log(f'  评论（创作中心）：{len(roots)} 主评论 + {n_sub} 楼中楼，无变化')
        return old
    write_json(vdir / 'comments.json', merged)
    log(f'  评论（创作中心）：{len(roots)} 主评论 + {n_sub} 楼中楼（站点计数 {total}）'
        + ('' if complete else '  [本次抓取不完整，可稍后重试]'))
    return merged


# ---------------------------------------------------------------- emotes

EMOTE_TOKEN = re.compile(r'\[[^\[\]\n]{1,40}\]')


def _all_replies(comments: dict):
    for r in comments.get('roots') or []:
        yield r
        yield from r.get('replies') or []


def _norm_pkg(name: str) -> str:
    return re.sub(r'\s+|静态|表情包|表情', '', name).lower()


def resolve_emotes(client: Client, comments: dict, archive: Path) -> int:
    """为缺少表情信息的评论补全表情（创作中心评论接口不返回 content.emote）。

    依次使用：存档中其它评论里出现过的表情 → 当前账号的表情面板 → 按表情包名称匹配全站表情包后查询。
    返回补全的评论条数。
    """
    missing = set()
    for r in _all_replies(comments):
        emote = (r.get('content') or {}).get('emote') or {}
        missing.update(t for t in EMOTE_TOKEN.findall((r.get('content') or {}).get('message', '')) if t not in emote)
    if not missing:
        return 0

    known: dict[str, dict] = {}
    for f in archive.glob('BV*/comments.json'):
        for r in _all_replies(read_json(f) or {}):
            known.update((r.get('content') or {}).get('emote') or {})

    def absorb(packages):
        for pkg in packages or []:
            for e in pkg.get('emote') or []:
                known.setdefault(e['text'], {'id': e.get('id'), 'package_id': e.get('package_id'), 'text': e['text'],
                                             'url': e.get('url'), 'meta': e.get('meta') or {},
                                             'jump_title': (e.get('meta') or {}).get('alias', '')})

    try:
        absorb((client.get('https://api.bilibili.com/x/emote/user/panel/web', {'business': 'reply'}) or {}).get('packages'))
    except ApiError:
        pass
    rest = missing - set(known)
    if rest:
        try:
            all_pkgs = (client.get('https://api.bilibili.com/x/emote/setting/panel', {'business': 'reply'}) or {}).get('all_packages') or []
        except ApiError:
            all_pkgs = []
        by_name = {}
        for pkg in all_pkgs:
            by_name.setdefault(_norm_pkg(pkg.get('text', '')), pkg['id'])
        ids = set()
        for t in rest:
            inner = t[1:-1]
            prefix = _norm_pkg(inner.rsplit('_', 1)[0]) if '_' in inner else ''
            if not prefix:
                continue
            pid = by_name.get(prefix) or next((i for n, i in by_name.items() if n.startswith(prefix) or (n and prefix.startswith(n))), None)
            if pid:
                ids.add(pid)
        ids = sorted(ids)
        for i in range(0, len(ids), 20):
            try:
                data = client.get('https://api.bilibili.com/x/emote/package',
                                  {'business': 'reply', 'ids': ','.join(map(str, ids[i:i + 20]))})
                absorb((data or {}).get('packages'))
            except ApiError as e:
                log(f'    !! 表情包查询失败：{e}')
            time.sleep(0.3)

    fixed = 0
    for r in _all_replies(comments):
        c = r.get('content') or {}
        emote = dict(c.get('emote') or {})
        add = {t: known[t] for t in EMOTE_TOKEN.findall(c.get('message', '')) if t not in emote and t in known}
        if add:
            emote.update(add)
            c['emote'] = emote
            fixed += 1
    unresolved = len(missing - set(known))
    log(f'  表情：补全 {fixed} 条评论中的表情' + (f'，{unresolved} 个方括号文本未找到对应表情（可能不是表情）' if unresolved else ''))
    return fixed


# ---------------------------------------------------------------- danmaku

def _varint(b: bytes, i: int):
    v = shift = 0
    while True:
        x = b[i]
        i += 1
        v |= (x & 0x7F) << shift
        if not x & 0x80:
            return v, i
        shift += 7


def _proto_fields(b: bytes):
    i = 0
    while i < len(b):
        key, i = _varint(b, i)
        field, wire = key >> 3, key & 7
        if wire == 0:
            v, i = _varint(b, i)
        elif wire == 2:
            n, i = _varint(b, i)
            v, i = b[i:i + n], i + n
        elif wire == 5:
            v, i = b[i:i + 4], i + 4
        elif wire == 1:
            v, i = b[i:i + 8], i + 8
        else:
            raise ValueError(f'unsupported wire type {wire}')
        yield field, v


# DanmakuElem（bilibili.community.service.dm.v1）字段编号
DM_FIELDS = {1: 'id', 2: 'progress', 3: 'mode', 4: 'fontsize', 5: 'color', 6: 'mid_hash', 7: 'content',
             8: 'ctime', 9: 'weight', 10: 'action', 11: 'pool', 12: 'id_str', 13: 'attr'}


def decode_danmaku(raw: bytes) -> list[dict]:
    """解析 DmSegMobileReply protobuf（字段 1 为 repeated DanmakuElem）。"""
    if not raw or raw[:1] == b'{':
        return []
    out = []
    for field, v in _proto_fields(raw):
        if field != 1 or not isinstance(v, bytes):
            continue
        d = {}
        for f, x in _proto_fields(v):
            name = DM_FIELDS.get(f)
            if not name:
                continue
            d[name] = x.decode('utf-8', 'replace') if isinstance(x, bytes) else x
        d.setdefault('progress', 0)
        d.setdefault('mode', 1)
        out.append(d)
    return out


def fetch_danmaku(client: Client, video: dict, vdir: Path):
    """抓取全部分P的弹幕：实时弹幕分段 + （登录时）每日历史弹幕，按弹幕 id 与已有存档合并。"""
    view = video['view']
    referer = f'https://www.bilibili.com/video/{view.get("bvid")}/'
    pages = view.get('pages') or [{'cid': view.get('cid'), 'page': 1, 'duration': view.get('duration', 0)}]
    old = read_json(vdir / 'danmaku.json') or {}
    items = {d['id_str'] if d.get('id_str') else str(d['id']): d for d in old.get('items') or []}
    before = len(items)

    def absorb(dms, cid):
        for d in dms:
            d['cid'] = cid
            key = d.get('id_str') or str(d.get('id'))
            items[key] = d

    for p in pages:
        cid = p.get('cid')
        if not cid:
            continue
        segs = max(1, -(-int(p.get('duration') or 0) // 360))
        n0 = len(items)
        for idx in range(1, segs + 1):
            try:
                raw = client.raw_get(f'https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid={cid}&segment_index={idx}', referer)
                absorb(decode_danmaku(raw), cid)
            except Exception as e:  # noqa: BLE001
                log(f'    !! 弹幕分段 cid={cid} #{idx} 失败：{e}')
            time.sleep(0.3)
        if client.logged_in:
            # 历史弹幕：按月列出有弹幕的日期，再逐日获取当日弹幕池
            start = time.localtime(view.get('pubdate') or view.get('ctime') or time.time())
            y, m = start.tm_year, start.tm_mon
            now = time.localtime()
            while (y, m) <= (now.tm_year, now.tm_mon):
                month = f'{y:04d}-{m:02d}'
                try:
                    dates = client.get('https://api.bilibili.com/x/v2/dm/history/index',
                                       {'type': 1, 'oid': cid, 'month': month}, referer=referer) or []
                except ApiError:
                    dates = []
                for date in dates:
                    try:
                        raw = client.raw_get(f'https://api.bilibili.com/x/v2/dm/web/history/seg.so?type=1&oid={cid}&date={date}', referer)
                        absorb(decode_danmaku(raw), cid)
                    except Exception as e:  # noqa: BLE001
                        log(f'    !! 历史弹幕 {date} 失败：{e}')
                    time.sleep(0.3)
                y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        log(f'    P{p.get("page", 1)} cid={cid}：{len(items) - n0} 条新弹幕')

    out = sorted(items.values(), key=lambda d: (d.get('cid', 0), d.get('progress', 0), d.get('ctime', 0), str(d.get('id'))))
    data = {
        'bvid': view.get('bvid'), 'fetched_at': now_str(),
        'pages': [{'cid': p.get('cid'), 'page': p.get('page'), 'part': p.get('part', '')} for p in pages],
        'items': out,
    }
    if same(old or None, data, ignore=('fetched_at',)):
        log(f'  弹幕：共 {len(out)} 条，无变化')
        return
    write_json(vdir / 'danmaku.json', data, indent=None)
    log(f'  弹幕：共 {len(out)} 条（本次新增 {len(out) - before} 条）')


# ---------------------------------------------------------------- media

def media_name(url: str) -> str:
    """B 站 bfs 文件名本身就是内容哈希，直接用作本地文件名。"""
    path = urllib.parse.urlparse(url if '//' in url else 'https:' + url).path
    name = path.rsplit('/', 1)[-1]
    return re.sub(r'[^0-9A-Za-z._-]', '_', name) or hashlib.md5(url.encode()).hexdigest()


def iter_comment_media(comments: dict):
    """遍历评论中需要本地化的图片：(子目录, url)。"""
    def walk(r):
        c = r.get('content') or {}
        for p in c.get('pictures') or []:
            if p.get('img_src'):
                yield 'pics', p['img_src']
        for e in (c.get('emote') or {}).values():
            if e.get('url'):
                yield 'emotes', e['url']
        for s in r.get('replies') or []:
            yield from walk(s)
    for r in comments.get('roots') or []:
        yield from walk(r)


def download(client: Client, url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return False
    if url.startswith('//'):
        url = 'https:' + url
    url = re.sub(r'^http://', 'https://', url)
    for attempt in range(4):
        try:
            data = client.raw_get(url, referer='https://www.bilibili.com/', timeout=60)
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_suffix(dest.suffix + '.part')
            tmp.write_bytes(data)
            os.replace(tmp, dest)
            return True
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                log(f'    !! 下载失败 {url}：{e}')
            time.sleep(1 + attempt)
    return False


def fetch_media(client: Client, vdir: Path):
    video = read_json(vdir / 'video.json') or {}
    comments = read_json(vdir / 'comments.json') or {}
    media = vdir / 'media'
    jobs = []
    pic = (video.get('view') or {}).get('pic')
    if pic:
        ext = os.path.splitext(media_name(pic))[1] or '.jpg'
        jobs.append((pic, media / f'cover{ext}'))
    seen = set()
    for sub, url in iter_comment_media(comments):
        if url in seen:
            continue
        seen.add(url)
        jobs.append((url, media / sub / media_name(url)))
    new = sum(download(client, url, dest) for url, dest in jobs)
    log(f'  图片：共 {len(jobs)} 个（封面 + 评论图片 + 表情），本次新下载 {new} 个')


# ---------------------------------------------------------------- CLI

def load_cookie(args) -> str:
    if args.cookie:
        return args.cookie
    if args.cookie_file:
        return Path(args.cookie_file).read_text(encoding='utf-8').strip()
    if os.environ.get('BILI_COOKIE'):
        return os.environ['BILI_COOKIE']
    default = ROOT_DIR / 'cookie.txt'
    if default.exists():
        return default.read_text(encoding='utf-8').strip()
    return ''


def normalize_cookie(raw: str) -> str:
    raw = raw.strip()
    if raw and '=' not in raw:  # 只给了 SESSDATA 的值
        raw = f'SESSDATA={raw}'
    return raw


def archived_bvids(archive: Path):
    return sorted(p.name for p in archive.iterdir() if p.is_dir() and BV_RE.match(p.name)) if archive.exists() else []


def resolve_targets(items, archive: Path):
    out = []
    for it in items:
        m = re.search(r'BV[0-9A-Za-z]{10}', it)
        if not m:
            raise SystemExit(f'无法识别的 BV 号：{it}')
        out.append(m.group(0))
    return out or archived_bvids(archive)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Bilibili 视频信息 / 评论区存档工具')
    ap.add_argument('--archive', default=str(DEFAULT_ARCHIVE), help='存档目录（默认 ./archive）')
    ap.add_argument('--cookie', help='登录 Cookie 字符串，如 "SESSDATA=...; bili_jct=..."')
    ap.add_argument('--cookie-file', help='保存 Cookie 字符串的文件')
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name, nargs, help_ in (('collect', '+', '抓取视频信息 + 全部评论 + 图片（需要登录）'),
                               ('update', '*', '更新存档中已有的全部（或指定）视频（需要登录）')):
        p = sub.add_parser(name, help=help_)
        p.add_argument('videos', nargs=nargs, help='BV 号或视频链接')
        p.add_argument('--skip-comments', action='store_true', help='不抓取评论')
        p.add_argument('--skip-media', action='store_true', help='不下载封面 / 评论图片')
        p.add_argument('--danmaku', action='store_true', help='同时导出弹幕（danmaku.json）')
    p = sub.add_parser('video', help='只刷新视频信息')
    p.add_argument('videos', nargs='*')
    p = sub.add_parser('media', help='只下载缺失的封面 / 评论图片')
    p.add_argument('videos', nargs='*')
    p = sub.add_parser('danmaku', help='只导出弹幕（登录后可额外获取历史弹幕）')
    p.add_argument('videos', nargs='*')
    args = ap.parse_args(argv)

    archive = Path(args.archive).resolve()
    archive.mkdir(parents=True, exist_ok=True)

    client = Client(normalize_cookie(load_cookie(args))).init()
    if client.logged_in:
        log(f'已登录：{client.nav.get("uname")}')
    targets = resolve_targets(args.videos, archive)
    if not targets:
        raise SystemExit('没有需要处理的视频')

    need_login = args.cmd in ('collect', 'update') and not args.skip_comments
    if need_login and not client.logged_in:
        raise SystemExit('抓取评论区需要登录：请通过 --cookie / --cookie-file / BILI_COOKIE 提供有效 Cookie')

    failed = []
    for i, bvid in enumerate(targets, 1):
        vdir = archive / bvid
        log(f'[{i}/{len(targets)}] {bvid}')
        try:
            video = None
            if args.cmd in ('collect', 'update', 'video'):
                video = fetch_video(client, bvid, vdir)
                if args.cmd != 'video' and not args.skip_comments:
                    status = video.get('status') or {}
                    if status.get('ok'):
                        fetch_comments(client, bvid, video, vdir)
                    elif status.get('source') == 'member':
                        fetch_comments_member(client, bvid, video, vdir)
                    else:
                        log('  视频已失效，跳过评论抓取（保留已有评论存档）')
            if args.cmd == 'danmaku' or (args.cmd in ('collect', 'update') and args.danmaku):
                video = video or read_json(vdir / 'video.json')
                if video and video.get('view'):
                    fetch_danmaku(client, video, vdir)
                else:
                    log('  没有视频信息，无法获取弹幕（请先 collect）')
            if args.cmd == 'media' and client.logged_in and (vdir / 'comments.json').exists():
                comments = read_json(vdir / 'comments.json')
                if resolve_emotes(client, comments, archive):
                    write_json(vdir / 'comments.json', canonical(comments))
            if args.cmd == 'media' or (args.cmd in ('collect', 'update') and not args.skip_media):
                fetch_media(client, vdir)
        except ApiError as e:
            log(f'  !! 失败：{e}')
            failed.append(bvid)
    if failed:
        log(f'以下视频处理失败：{" ".join(failed)}')
        sys.exit(1)


if __name__ == '__main__':
    main()
