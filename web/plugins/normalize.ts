/**
 * 把 archive/<BV>/ 下的原始 API 数据转换成前端使用的精简结构（见 src/types.ts）。
 * 本地已下载的图片会被替换为站内路径，其余（头像、头像框等）保留 B 站 CDN 地址。
 */
import fs from 'node:fs'
import path from 'node:path'
import type {
  Comment, CommentData, Danmaku, DanmakuData, SailingCard, Stat, User, VideoDetail, VideoPayload, VideoSummary, Vip,
} from '../src/types'

type Raw = Record<string, any>

const BV_RE = /^BV[0-9A-Za-z]{10}$/

export function listArchived(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(n => BV_RE.test(n) && fs.existsSync(path.join(dir, n, 'video.json')))
    .sort()
}

// 按修改时间缓存解析结果，避免开发时每次请求都重新解析十几 MB 的评论文件
const jsonCache = new Map<string, { mtime: number; data: Raw | null }>()

function readJson(file: string): Raw | null {
  try {
    const mtime = fs.statSync(file).mtimeMs
    const hit = jsonCache.get(file)
    if (hit && hit.mtime === mtime) return hit.data
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    jsonCache.set(file, { mtime, data })
    return data
  } catch {
    return null
  }
}

/** 与 collector/bili_archive.py 中的 media_name 保持一致 */
export function mediaName(url: string): string {
  let p = url
  try {
    p = new URL(url.startsWith('//') ? 'https:' + url : url).pathname
  } catch { /* 保持原样 */ }
  return (p.split('/').pop() || '').replace(/[^0-9A-Za-z._-]/g, '_')
}

function https(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('//')) return 'https:' + url
  return url.replace(/^http:\/\//, 'https://')
}

class MediaResolver {
  constructor(private dir: string, private bvid: string, private base: string) {}

  local(sub: string, url: string): string {
    if (!url) return ''
    const name = mediaName(url)
    if (name && fs.existsSync(path.join(this.dir, this.bvid, 'media', sub, name))) {
      return `${this.base}media/${this.bvid}/${sub}/${name}`
    }
    return https(url)
  }

  cover(url: string): string {
    const mdir = path.join(this.dir, this.bvid, 'media')
    if (fs.existsSync(mdir)) {
      const f = fs.readdirSync(mdir).find(n => n.startsWith('cover.'))
      if (f) return `${this.base}media/${this.bvid}/${f}`
    }
    return https(url)
  }
}

function stat(s: Raw | undefined): Stat {
  return {
    view: s?.view ?? 0, danmaku: s?.danmaku ?? 0, reply: s?.reply ?? 0, favorite: s?.favorite ?? 0,
    coin: s?.coin ?? 0, share: s?.share ?? 0, like: s?.like ?? 0,
  }
}

function vip(v: Raw | undefined): Vip {
  // 评论区接口与稿件接口的字段命名不同（vipStatus / status）
  const status = v?.vipStatus ?? v?.status ?? 0
  const type = v?.vipType ?? v?.type ?? 0
  return {
    status,
    type,
    nameColor: status ? (v?.nickname_color || (type === 2 ? '#FB7299' : '')) : '',
    subscript: !!status && (v?.avatar_subscript === 1 || type === 2),
  }
}

function gradient(fan: Raw): string {
  const cf = fan.color_format
  if (cf?.colors?.length) {
    const stops = cf.colors.map((c: string, i: number) => `${c} ${cf.gradients?.[i] ?? 0}%`).join(', ')
    return `linear-gradient(135deg, ${stops})`
  }
  return fan.color || ''
}

function sailingCard(m: Raw): SailingCard | null {
  const c = m.user_sailing_v2?.card_bg || m.user_sailing?.cardbg
  if (!c?.image) return null
  const fan = c.fan || {}
  return {
    image: https(c.image),
    name: c.name || '',
    prefix: fan.is_fan ? (fan.num_prefix || 'NO.') : '',
    num: fan.is_fan ? (fan.num_desc || String(fan.number || '')) : '',
    gradient: fan.is_fan ? gradient(fan) : '',
    jumpUrl: c.jump_url || '',
  }
}

function user(m: Raw): User {
  const pendant = m.user_sailing_v2?.pendant || m.pendant || {}
  return {
    mid: String(m.mid ?? ''),
    name: m.uname ?? m.name ?? '',
    face: https(m.avatar ?? m.face),
    level: m.level_info?.current_level ?? 0,
    senior: !!m.is_senior_member,
    sign: m.sign ?? '',
    vip: vip(m.vip),
    official: m.official_verify?.type ?? -1,
    officialDesc: m.official_verify?.desc ?? '',
    pendant: https(pendant.image_enhance || pendant.image),
    pendantName: pendant.name || '',
    card: sailingCard(m),
  }
}

function comment(r: Raw, media: MediaResolver): Comment {
  const c = r.content || {}
  const ctrl = r.reply_control || {}
  const emote: Comment['emote'] = {}
  for (const [k, e] of Object.entries<Raw>(c.emote || {})) {
    // 「[Floating Dream静态表情包_微笑]」→「微笑」
    const name = k.replace(/^\[|\]$/g, '')
    emote[k] = { url: media.local('emotes', e.url), title: name.split('_').pop() || name }
  }
  const jump: Comment['jump'] = {}
  for (const [k, j] of Object.entries<Raw>(c.jump_url || {})) {
    jump[k] = { title: j.title || k, icon: https(j.prefix_icon), url: j.pc_url || '' }
  }
  const at: Comment['at'] = {}
  for (const [k, v] of Object.entries(c.at_name_to_mid_str || c.at_name_to_mid || {})) at[k] = String(v)
  const out: Comment = {
    id: String(r.rpid_str ?? r.rpid),
    root: String(r.root_str ?? r.root ?? 0),
    parent: String(r.parent_str ?? r.parent ?? 0),
    mid: String(r.mid_str ?? r.mid),
    ctime: r.ctime ?? 0,
    like: r.like ?? 0,
    rcount: r.rcount ?? 0,
    user: user(r.member || {}),
    msg: c.message ?? '',
    emote,
    at,
    jump,
    pics: (c.pictures || []).map((p: Raw) => ({
      src: media.local('pics', p.img_src),
      remote: https(p.img_src),
      w: p.img_width || 0,
      h: p.img_height || 0,
      size: p.img_size || 0,
    })),
    maxLine: c.max_line || ctrl.max_line || 6,
    location: (ctrl.location || '').replace(/^IP属地：/, ''),
    upLike: !!(r.up_action?.like || ctrl.up_like),
    upReply: !!(r.up_action?.reply || ctrl.up_reply),
    labels: (r.card_label || [])
      .filter((l: Raw) => l.text_content)
      .map((l: Raw) => ({
        text: l.text_content,
        color: l.text_color_day || '',
        bg: l.label_color_day || '',
        colorDark: l.text_color_night || '',
        bgDark: l.label_color_night || '',
      })),
    top: !!r._is_top,
    note: !!ctrl.is_note_v2 || (r.note_cvid_str && r.note_cvid_str !== '0'),
    gone: r._gone_since || '',
    orphan: !!r._orphan_sub,
  }
  if (!r.root || r._orphan_sub) {
    out.replies = (r.replies || []).map((s: Raw) => comment(s, media))
    out.preview = (r._preview || []).map(String)
    out.subComplete = r._sub_complete !== false
  }
  return out
}

function comments(raw: Raw, media: MediaResolver): CommentData {
  return {
    upperMid: String(raw.upper_mid ?? ''),
    allCount: raw.all_count ?? 0,
    crawlTime: raw.crawl_time ?? '',
    firstArchivedAt: raw.first_archived_at ?? '',
    crawls: raw.crawls || [],
    orderHot: (raw.order_hot || []).map(String),
    orderTime: (raw.order_time || []).map(String),
    roots: (raw.roots || []).map((r: Raw) => comment(r, media)),
  }
}

/** archive/reupload.json：{ "原视频BV": "补档BV" 或 ["补档BV", ...] } */
function readReupload(dir: string): Map<string, string[]> {
  const raw = readJson(path.join(dir, 'reupload.json')) || {}
  const map = new Map<string, string[]>()
  for (const [k, v] of Object.entries(raw)) {
    if (!BV_RE.test(k)) continue
    const list = (Array.isArray(v) ? v : [v]).map(String).filter(x => BV_RE.test(x))
    if (list.length) map.set(k, list)
  }
  return map
}

function reuploadInfo(dir: string, bvid: string) {
  const map = readReupload(dir)
  const archived = new Set(listArchived(dir))
  const of: string[] = []
  for (const [k, v] of map) if (v.includes(bvid)) of.push(k)
  const wrap = (list: string[]) => list.map(b => ({ bvid: b, archived: archived.has(b) }))
  return { reupload: wrap(map.get(bvid) || []), reuploadOf: wrap(of) }
}

function danmakuCount(dir: string, bvid: string): number | null {
  const d = readJson(path.join(dir, bvid, 'danmaku.json'))
  return d ? (d.items || []).length : null
}

function summary(bvid: string, video: Raw, raw: Raw | null, media: MediaResolver, dir: string): VideoSummary {
  const v = video.view || {}
  const subs = raw ? (raw.roots || []).reduce((n: number, r: Raw) => n + (r.replies?.length || 0), 0) : 0
  const roots = raw ? (raw.roots || []).length : 0
  return {
    bvid,
    aid: v.aid ?? video.aid,
    title: v.title ?? '',
    cover: media.cover(v.pic),
    duration: v.duration ?? 0,
    pubdate: v.pubdate ?? 0,
    owner: { mid: String(v.owner?.mid ?? ''), name: v.owner?.name ?? '', face: https(v.owner?.face) },
    stat: stat(v.stat || video.snapshots?.at(-1)?.stat),
    statKnown: !!(v.stat || video.snapshots?.length),
    tname: v.tname_v2 || v.tname || '',
    tags: (video.tags || []).map((t: Raw) => t.tag_name),
    status: video.status || { ok: true, code: 0, message: 'OK', checked_at: video.fetched_at },
    archivedAt: video.first_archived_at || video.fetched_at || '',
    updatedAt: video.fetched_at || '',
    comments: raw
      ? { roots, subs, total: roots + subs, siteCount: raw.all_count ?? v.stat?.reply ?? 0, crawlTime: raw.crawl_time ?? '' }
      : null,
    danmaku: danmakuCount(dir, bvid),
    ...reuploadInfo(dir, bvid),
  }
}

function detail(bvid: string, video: Raw, raw: Raw | null, media: MediaResolver, dir: string): VideoDetail {
  const v = video.view || {}
  const card = video.card || {}
  const cc = card.card || {}
  return {
    ...summary(bvid, video, raw, media, dir),
    desc: v.desc ?? '',
    descV2: v.desc_v2 || [],
    dynamic: v.dynamic ?? '',
    ctime: v.ctime ?? 0,
    copyright: v.copyright ?? 1,
    noReprint: !!v.rights?.no_reprint,
    dimension: v.dimension || null,
    cid: v.cid ?? 0,
    pages: (v.pages || []).map((p: Raw) => ({ cid: p.cid, page: p.page, part: p.part, duration: p.duration })),
    staff: (v.staff || []).map((s: Raw) => ({
      mid: String(s.mid), title: s.title, name: s.name, face: https(s.face), follower: s.follower ?? 0,
      vip: vip(s.vip), official: s.official?.type ?? -1,
    })),
    tagList: (video.tags || []).map((t: Raw) => ({ name: t.tag_name, type: t.tag_type || '', jumpUrl: t.jump_url || '' })),
    upCard: cc.mid
      ? {
          fans: card.follower ?? cc.fans ?? 0,
          sign: cc.sign ?? '',
          level: cc.level_info?.current_level ?? 0,
          vip: vip(cc.vip),
          official: cc.Official?.type ?? cc.official_verify?.type ?? -1,
          officialTitle: cc.Official?.title || cc.official_verify?.desc || '',
          archiveCount: card.archive_count ?? 0,
        }
      : null,
    honor: (v.honor_reply?.honor || []).map((h: Raw) => h.desc).filter(Boolean),
    argue: v.argue_info?.argue_msg || '',
    snapshots: (video.snapshots || []).map((s: Raw) => ({ time: s.time, stat: stat(s.stat) })),
    firstArchivedAt: video.first_archived_at || '',
  }
}

export function buildIndex(dir: string, base: string): VideoSummary[] {
  return listArchived(dir).map(bvid => {
    const video = readJson(path.join(dir, bvid, 'video.json')) || {}
    const raw = readJson(path.join(dir, bvid, 'comments.json'))
    return summary(bvid, video, raw, new MediaResolver(dir, bvid, base), dir)
  }).sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || '') || b.pubdate - a.pubdate)
}

export function buildVideo(dir: string, bvid: string, base: string): VideoPayload | null {
  const video = readJson(path.join(dir, bvid, 'video.json'))
  if (!video) return null
  const raw = readJson(path.join(dir, bvid, 'comments.json'))
  const media = new MediaResolver(dir, bvid, base)
  return { video: detail(bvid, video, raw, media, dir), comments: raw ? comments(raw, media) : null }
}

export function buildDanmaku(dir: string, bvid: string): DanmakuData | null {
  const d = readJson(path.join(dir, bvid, 'danmaku.json'))
  if (!d) return null
  return {
    fetchedAt: d.fetched_at || '',
    pages: d.pages || [],
    items: (d.items || []).map((x: Raw): Danmaku => [
      x.progress ?? 0, x.mode ?? 1, x.fontsize ?? 25, x.color ?? 0xffffff, x.ctime ?? 0, x.content ?? '',
      x.mid_hash ?? '', String(x.id_str || x.id || ''), x.pool ?? 0, x.cid ?? 0,
    ]),
  }
}
