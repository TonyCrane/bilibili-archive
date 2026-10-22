# bilibili-archive

保存 B 站原视频的稿件信息、封面与完整评论区（含楼中楼、评论图片），并提供一个还原 B 站样式的网页用于查阅。

```
bilibili-archive/
├── archive/                  存档数据（每个视频一个目录）
│   ├── BVxxxxxxxxxx/
│   │   ├── video.json        稿件信息 + UP 主卡片 + 标签 + 历次数据快照
│   │   ├── comments.json     全部评论（API 原始对象，多次抓取自动合并）
│   │   ├── danmaku.json      弹幕（可选导出）
│   │   └── media/            封面 cover.*、评论图片 pics/、评论表情 emotes/
│   └── reupload.json         原视频 → 补档视频 的对应关系（手动填写）
├── collector/
│   └── bili_archive.py       抓取 / 更新脚本（仅依赖 Python 3.9+ 标准库）
└── web/                      前端（Vue 3 + Vite + TypeScript）
```

## 抓取与更新数据

抓取评论区需要登录 Cookie（至少包含 `SESSDATA`，建议同时提供 `bili_jct`）。Cookie 可以用以下任一方式提供：

- `--cookie "SESSDATA=...; bili_jct=..."`
- `--cookie-file path/to/cookie.txt`（文件内容为同样格式的一行）
- 环境变量 `BILI_COOKIE`
- 项目根目录下的 `cookie.txt`（已在 `.gitignore` 中忽略）

```bash
# 新增 / 重新抓取视频（视频信息 + 全部评论 + 封面与评论图片）
python3 collector/bili_archive.py collect BVxxxxxxxxxx https://www.bilibili.com/video/BVyyyyyyyyyy/

# 更新存档中的全部视频
python3 collector/bili_archive.py update

# 同时导出弹幕；或只导出 / 更新弹幕
python3 collector/bili_archive.py collect BVxxxxxxxxxx --danmaku
python3 collector/bili_archive.py danmaku

# 只刷新视频信息（播放量等，会追加一条数据快照）
python3 collector/bili_archive.py video

# 只补全缺失的封面 / 评论图片（不需要登录）
python3 collector/bili_archive.py media
```

存档行为说明：

- 评论按「最热」「最新」两种排序各翻一遍，再逐条抓取全部楼中楼；保留 B 站默认展示的楼中楼预览与置顶信息。
- 再次抓取时与已有存档合并：原视频中已被删除的评论**不会丢失**，会标记为「已删除」并保留。
- **没有变化就不写入**：再次抓取后若内容与存档一致，`video.json` / `comments.json` / `danmaku.json` 都不会被修改（也不会新增数据快照或抓取记录），方便用 git 跟踪真实变化。数据快照只在播放、弹幕、评论、收藏、投币、分享、点赞七项数据之一变化时追加；UP 主账号层面的计数（粉丝、总获赞）变化不算视频信息变化。
- 接口每次请求都会随机变化的字段（图片 CDN 域名 i0/i1/i2、搜索链接中的 seid 与 A/B 实验参数、「3天前发布」这类相对时间、大会员标签图片）在保存前统一规范化或去掉。
- 原视频失效时，`video.json` 中保留最后一次成功获取的信息，并记录失效状态，网页会显示「原视频已失效」。
- **被锁定 / 下线的稿件**：公开接口无法访问，如果登录 Cookie 是该稿件 UP 主本人的，会自动改用创作中心接口（稿件信息 + 「评论管理」中的全部评论）抓取，并记录锁定原因。播放量等数据取自创作中心的稿件数据，即锁定时的数据。
- **弹幕**（可选）：抓取全部分P的实时弹幕分段，登录时还会逐日抓取历史弹幕，按弹幕 id 与已有存档合并。网页的「弹幕列表」可搜索，并能导出 B 站格式的 XML 弹幕文件。
- 评论中的图片和表情下载到本地；头像、头像框、装扮卡片等直接使用 B 站 CDN。
- 站点评论计数通常比实际可抓取的多几条（已删除 / 审核中 / 被折叠的评论无法通过接口获取）。

## 补档对应关系

在 `archive/reupload.json` 中手动填写原视频与补档视频的 BV 号（值可以是一个 BV 号，也可以是数组）：

```json
{
  "BVxxxxxxxxxx": "BVyyyyyyyyyy",
  "BVzzzzzzzzzz": ["BVaaaaaaaaaa", "BVbbbbbbbbbb"]
}
```

（以上为占位符，请替换为实际的 BV 号。）

原视频失效时，视频页播放器位置会显示「前往补档视频」（没有配置时显示「暂未补档」），首页卡片显示「已补档 / 暂未补档」；补档视频也在存档中时，两边会互相链接。修改后开发服务器会自动刷新。

## 网页

```bash
cd web
npm install
npm run dev        # 开发服务器 http://localhost:5173 ，自动读取 ../archive，存档变化后自动刷新
npm run build      # 生成静态站点到 web/dist（包含数据与图片，可直接部署）
npm run preview    # 预览构建结果
```

- 站点配置（可选）：把 `web/.env.example` 复制为 `web/.env` 后修改，未设置的项使用 `web/src/site.ts` 中的默认值；修改后重新启动开发服务器或重新构建。
  - `VITE_SITE_TITLE`：网站标题，用于浏览器标题栏与首页
  - `VITE_SITE_DESCRIPTION`：首页标题下的简介与 `<meta name="description">`，设为空则不显示
  - `VITE_REPO_URL`：顶栏 GitHub 图标链接，设为空则不显示
- 不需要手动登记视频：插件会扫描 `archive/` 下所有 `BV*/video.json`。可用 `ARCHIVE_DIR` 环境变量指定其它存档目录，部署到子路径时设置 `BASE_URL`（如 `BASE_URL=/archive/ npm run build`）。
- 构建产物使用 History 路由，并附带 `404.html` 作为回退，GitHub Pages 等静态托管可直接使用；其它服务器请把未知路径回退到 `index.html`。

页面功能：

- **首页**：全部存档视频，支持按标题 / UP 主 / 标签 / BV 号 / av 号搜索，按发布时间（默认）、存档时间、播放、评论数排序；输入 BV 号或 av 号直接跳转。
- **视频页**：网页端布局仿 B 站视频页（标题、数据、封面、点赞投币收藏转发、简介、标签、UP 主或创作团队），右侧固定栏（可独立滚动）为存档信息、数据快照与弹幕列表。
- **评论区**：网页端还原 B 站新版评论区（等级图标、大会员昵称颜色、头像框、装扮粉丝卡片、表情、@、关键词链接、评论图片、「UP主觉得很赞」等标签、楼中楼分页）；手机端还原 B 站 App 评论区（简介 / 评论标签栏、按热度 / 时间、评论详情页）；长评论在末尾显示「…展开」。
- 「笔记长评」筛选：正文（不含表情）不少于 100 字的评论，阈值见 `web/src/composables/comments.ts` 中的 `LONG_COMMENT_CHARS`。
- 表情与文字等高，电脑上悬停、手机上点击可放大查看。
- 评论搜索（内容 / 用户名 / UID / rpid，高亮命中）、图片查看器、`/video/BV…#reply<rpid>` 评论定位链接、复制评论链接。
- 浅色 / 深色主题：默认跟随系统，可在页面右上角切换。

## B 站素材说明

本项目为非官方的个人存档工具，与哔哩哔哩（bilibili）无关联。为还原 B 站的界面，仓库中包含以下取自 B 站的素材，其版权与商标归哔哩哔哩（bilibili）所有，不适用本项目的开源许可证：

- `web/public/favicon.ico`：B 站网站图标
- `web/src/assets/bili-logo.svg`：B 站 Logo
- `web/public/img/level_*.svg`：用户等级图标
- `web/src/components/Icon.vue` 中的点赞、点踩、更多、返回、表情图标路径（取自 B 站网页端评论组件）

另外，装扮粉丝卡片编号使用的字体为商用字体（锐字锐线，© 上海锐线创意设计），**不包含在仓库中**，网页运行时从 B 站 CDN 加载；加载失败时退回系统字体。头像、头像框、装扮卡片、表情包等图片同样来自 B 站 CDN，存档中的评论内容版权归各自的作者所有。

## 许可证

本项目代码以 [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）发布；上文所列 B 站素材除外。
