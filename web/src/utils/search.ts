import type { VideoSummary } from '../types'

const XOR = 23442827791579n
const MASK = 2251799813685247n
const BASE = 58n
const TABLE = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'

/** BV 号 → av 号（B 站公开的转换算法） */
export function bv2av(bvid: string): number {
  const chars = bvid.split('')
  ;[chars[3], chars[9]] = [chars[9], chars[3]]
  ;[chars[4], chars[7]] = [chars[7], chars[4]]
  let tmp = 0n
  for (const c of chars.slice(3)) tmp = tmp * BASE + BigInt(TABLE.indexOf(c))
  return Number((tmp & MASK) ^ XOR)
}

/** av 号 → BV 号 */
export function av2bv(aid: number): string {
  const bytes = ['B', 'V', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0']
  let i = bytes.length - 1
  let tmp = (BigInt(aid) | (MASK + 1n)) ^ XOR
  while (tmp > 0n) {
    bytes[i--] = TABLE[Number(tmp % BASE)]
    tmp /= BASE
  }
  ;[bytes[3], bytes[9]] = [bytes[9], bytes[3]]
  ;[bytes[4], bytes[7]] = [bytes[7], bytes[4]]
  return bytes.join('')
}

/** 从输入中识别 BV 号 / av 号 / 视频链接，返回 BV 号 */
export function parseVideoId(text: string): string | null {
  const bv = text.match(/BV1[0-9A-Za-z]{9}/)
  if (bv) return bv[0]
  const av = text.match(/(?:^|[^a-z])av(\d+)/i)
  if (av) return av2bv(Number(av[1]))
  return null
}

export function matchVideo(v: VideoSummary, q: string): boolean {
  const k = q.trim().toLowerCase()
  if (!k) return true
  return [v.title, v.bvid, `av${v.aid}`, v.owner.name, v.owner.mid, v.tname, ...v.tags]
    .some(s => s && String(s).toLowerCase().includes(k))
}
