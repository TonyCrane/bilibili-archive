// 前端使用的精简数据结构，由 archive-plugin 从 archive/ 中的原始 API 数据生成

export interface ArchiveStatus {
  ok: boolean
  code: number
  message: string
  checked_at: string
  /** 稿件被锁定 / 下线的原因（创作中心接口提供） */
  reason?: string
  /** member：信息来自创作中心接口 */
  source?: string
}

export interface Stat {
  view: number
  danmaku: number
  reply: number
  favorite: number
  coin: number
  share: number
  like: number
}

export interface VideoSummary {
  bvid: string
  aid: number
  title: string
  cover: string
  duration: number
  pubdate: number
  owner: { mid: string; name: string; face: string }
  stat: Stat
  /** 是否有播放量等数据（被锁定后才存档的视频没有） */
  statKnown: boolean
  tname: string
  tags: string[]
  status: ArchiveStatus
  archivedAt: string
  updatedAt: string
  comments: { roots: number; subs: number; total: number; siteCount: number; crawlTime: string } | null
  /** 已存档的弹幕条数，未导出弹幕时为 null */
  danmaku: number | null
  /** 补档视频（archive/reupload.json 中配置），archived 表示该视频也在存档中 */
  reupload: { bvid: string; archived: boolean }[]
  /** 以本视频为补档的原视频 */
  reuploadOf: { bvid: string; archived: boolean }[]
}

export interface Vip {
  status: number
  type: number
  nameColor: string
  subscript: boolean
}

export interface SailingCard {
  image: string
  name: string
  prefix: string
  num: string
  gradient: string
  jumpUrl: string
}

export interface User {
  mid: string
  name: string
  face: string
  level: number
  senior: boolean
  sign: string
  vip: Vip
  official: number // -1 无, 0 个人认证, 1 机构认证
  officialDesc: string
  pendant: string
  pendantName: string
  card: SailingCard | null
}

export interface Picture {
  src: string
  remote: string
  w: number
  h: number
  size: number
}

export interface CommentLabel {
  text: string
  color: string
  bg: string
  colorDark: string
  bgDark: string
}

export interface Comment {
  id: string
  root: string
  parent: string
  mid: string
  ctime: number
  like: number
  rcount: number
  user: User
  msg: string
  emote: Record<string, { url: string; title: string }>
  at: Record<string, string>
  jump: Record<string, { title: string; icon: string; url: string }>
  pics: Picture[]
  maxLine: number
  location: string
  upLike: boolean
  upReply: boolean
  labels: CommentLabel[]
  top: boolean
  note: boolean
  gone: string
  /** 主评论已被删除的楼中楼（单独成层） */
  orphan: boolean
  /** 楼中楼（仅主评论有） */
  replies?: Comment[]
  /** B 站默认展示的楼中楼预览 */
  preview?: string[]
  subComplete?: boolean
}

export interface CommentData {
  upperMid: string
  allCount: number
  crawlTime: string
  firstArchivedAt: string
  crawls: { time: string; roots: number; subs: number; all_count: number | null; complete: boolean; source?: string }[]
  orderHot: string[]
  orderTime: string[]
  roots: Comment[]
}

export interface StaffMember {
  mid: string
  title: string
  name: string
  face: string
  follower: number
  vip: Vip
  official: number
}

export interface VideoDetail extends VideoSummary {
  desc: string
  descV2: { raw_text: string; type: number; biz_id: number }[]
  dynamic: string
  ctime: number
  copyright: number
  noReprint: boolean
  dimension: { width: number; height: number; rotate: number } | null
  pages: { cid: number; page: number; part: string; duration: number }[]
  cid: number
  staff: StaffMember[]
  tagList: { name: string; type: string; jumpUrl: string }[]
  upCard: {
    fans: number
    sign: string
    level: number
    vip: Vip
    official: number
    officialTitle: string
    archiveCount: number
  } | null
  honor: string[]
  argue: string
  snapshots: { time: string; stat: Stat }[]
  firstArchivedAt: string
}

export interface VideoPayload {
  video: VideoDetail
  comments: CommentData | null
}

/** 评论定位目标（#reply<rpid>） */
export interface FocusTarget {
  id: string
  rootId: string
  subId: string
  n: number
}

/** 弹幕：[进度ms, 模式, 字号, 颜色, 发送时间, 内容, 发送者哈希, id, 弹幕池, cid] */
export type Danmaku = [number, number, number, number, number, string, string, string, number, number]

export interface DanmakuData {
  fetchedAt: string
  pages: { cid: number; page: number; part: string }[]
  items: Danmaku[]
}
