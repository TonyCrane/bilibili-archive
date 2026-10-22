import { onBeforeUnmount, reactive, ref } from 'vue'
import type { DanmakuData, VideoPayload, VideoSummary } from '../types'

// ---------------------------------------------------------------- 主题

export type ThemeMode = 'auto' | 'light' | 'dark'

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const readMode = (): ThemeMode => {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export const theme = reactive({
  mode: readMode(),
  dark: false,
})

function applyTheme() {
  theme.dark = theme.mode === 'dark' || (theme.mode === 'auto' && systemDark.matches)
  if (theme.mode === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme.mode
}
applyTheme()
systemDark.addEventListener('change', applyTheme)

export function setTheme(mode: ThemeMode) {
  theme.mode = mode
  try {
    if (mode === 'auto') localStorage.removeItem('theme')
    else localStorage.setItem('theme', mode)
  } catch { /* 隐私模式下无法保存 */ }
  applyTheme()
}

export function cycleTheme() {
  setTheme(theme.mode === 'auto' ? (theme.dark ? 'light' : 'dark') : theme.mode === 'light' ? 'dark' : 'auto')
}

// ---------------------------------------------------------------- 布局断点

const mobileQuery = window.matchMedia('(max-width: 767px)')
export const viewport = reactive({ mobile: mobileQuery.matches })
mobileQuery.addEventListener('change', e => (viewport.mobile = e.matches))

// ---------------------------------------------------------------- 数据

const base = import.meta.env.BASE_URL
let indexPromise: Promise<VideoSummary[]> | null = null
const videoCache = new Map<string, Promise<VideoPayload | null>>()

export function loadIndex(): Promise<VideoSummary[]> {
  indexPromise ??= fetch(`${base}data/index.json`).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
  indexPromise.catch(() => (indexPromise = null))
  return indexPromise
}

export function loadVideo(bvid: string): Promise<VideoPayload | null> {
  let p = videoCache.get(bvid)
  if (!p) {
    p = fetch(`${base}data/video/${bvid}.json`).then(r => {
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    p.catch(() => videoCache.delete(bvid))
    videoCache.set(bvid, p)
  }
  return p
}

const danmakuCache = new Map<string, Promise<DanmakuData | null>>()
export function loadDanmaku(bvid: string): Promise<DanmakuData | null> {
  let p = danmakuCache.get(bvid)
  if (!p) {
    p = fetch(`${base}data/danmaku/${bvid}.json`).then(r => (r.ok ? r.json() : null))
    p.catch(() => danmakuCache.delete(bvid))
    danmakuCache.set(bvid, p)
  }
  return p
}

// ---------------------------------------------------------------- 轻提示

export const toastState = reactive({ text: '', visible: false })
let toastTimer: number | undefined
export function toast(text: string) {
  toastState.text = text
  toastState.visible = true
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastState.visible = false), 1800)
}

export async function copyText(text: string, tip = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(text)
    toast(tip)
  } catch {
    toast('复制失败，请手动复制')
  }
}

// ---------------------------------------------------------------- 图片查看器

export const viewer = reactive({
  open: false,
  index: 0,
  list: [] as { src: string; remote: string }[],
})

export function openViewer(list: { src: string; remote: string }[], index: number) {
  viewer.list = list
  viewer.index = index
  viewer.open = true
}

// ---------------------------------------------------------------- 字体

// 装扮粉丝卡片编号使用 B 站的字体。该字体为商用字体，不随仓库分发，
// 运行时从 B 站 CDN 加载；CSS @font-face 会带上 Referer 触发防盗链，因此用 fetch 去掉 Referer 后注册
const FAN_FONT_URL = 'https://i0.hdslb.com/bfs/activity-plat/static/20250825/a370089fc7c797ab7a9d638df8c9cbf7/udPIK7Y9ix.ttf'
let fanFont: Promise<void> | null = null

export function loadFanFont() {
  fanFont ??= fetch(FAN_FONT_URL, { referrerPolicy: 'no-referrer', mode: 'cors' })
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(buf => new FontFace('fans-num', buf).load())
    .then(face => void document.fonts.add(face))
    .catch(() => {
      // 加载失败时退回系统字体
    })
  return fanFont
}

// ---------------------------------------------------------------- 工具

/** 元素接近视口时回调（用于无限滚动）。IntersectionObserver 之外再监听滚动，保证在各种环境下都能触发 */
export function useInfinite(cb: () => void) {
  const el = ref<HTMLElement | null>(null)
  let io: IntersectionObserver | null = null
  let ticking = false
  const near = () => {
    const e = el.value
    if (!e || !e.offsetParent) return false
    const r = e.getBoundingClientRect()
    return r.top < window.innerHeight + 600 && r.bottom > -600
  }
  const check = () => {
    if (ticking) return
    ticking = true
    setTimeout(() => {
      ticking = false
      if (near()) cb()
    }, 50)
  }
  const stop = () => {
    io?.disconnect()
    window.removeEventListener('scroll', check, true)
    window.removeEventListener('resize', check)
  }
  const start = () => {
    stop()
    io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) cb()
    }, { rootMargin: '600px 0px' })
    if (el.value) io.observe(el.value)
    window.addEventListener('scroll', check, { capture: true, passive: true })
    window.addEventListener('resize', check, { passive: true })
    check()
  }
  onBeforeUnmount(stop)
  return { el, start, stop }
}
