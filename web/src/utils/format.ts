const pad = (n: number) => String(n).padStart(2, '0')

/** 12345 → 1.2万，与 B 站一致 */
export function count(n: number | undefined | null): string {
  const v = n ?? 0
  if (v >= 1e8) return `${trim(v / 1e8)}亿`
  if (v >= 1e4) return `${trim(v / 1e4)}万`
  return String(v)
}

function trim(v: number) {
  return v.toFixed(1).replace(/\.0$/, '')
}

export function duration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 网页端格式：2026-10-21 16:39 */
export function dateTime(ts: number, seconds = false): string {
  const d = new Date(ts * 1000)
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return seconds ? `${base}:${pad(d.getSeconds())}` : base
}

export function date(ts: number): string {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** App 端格式：今年显示「10月18日」，往年显示「2025-10-18」 */
export function mDate(ts: number): string {
  const d = new Date(ts * 1000)
  if (d.getFullYear() === new Date().getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return date(ts)
}

/** 首页卡片：今年「10-18」，往年「2025-10-18」 */
export function shortDate(ts: number): string {
  const d = new Date(ts * 1000)
  if (d.getFullYear() === new Date().getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return date(ts)
}

/** B 站图片 CDN 缩略图（本地图片原样返回） */
export function thumb(url: string, w: number, h?: number): string {
  if (!url || !/hdslb\.com\/bfs\//.test(url) || url.includes('@')) return url
  const ext = /\.gif$/i.test(url) ? '' : '.webp'
  return `${url}@${w}w${h ? `_${h}h_1c` : ''}${ext}`
}

export function bvToUrl(bvid: string) {
  return `https://www.bilibili.com/video/${bvid}/`
}

export function spaceUrl(mid: string | number) {
  return `https://space.bilibili.com/${mid}`
}
