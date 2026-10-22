import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import type { Comment, CommentData } from '../types'

export type SortMode = 'hot' | 'time'
export type FilterMode = 'all' | 'note'

/** 「笔记长评」：去掉表情后正文不少于这么多字的主评论 */
export const LONG_COMMENT_CHARS = 100

export function isLongComment(c: Comment): boolean {
  return [...c.msg.replace(/\[[^\]\n]{1,40}\]/g, '').trim()].length >= LONG_COMMENT_CHARS
}

export interface ListItem {
  root: Comment
  /** 搜索时命中的楼中楼 */
  matches: Comment[] | null
}

const PAGE = 20

export function matchComment(c: Comment, kw: string): boolean {
  if (!kw) return true
  const k = kw.toLowerCase()
  return c.msg.toLowerCase().includes(k) || c.user.name.toLowerCase().includes(k) || c.mid === kw || c.id === kw
}

/** 楼中楼的默认预览：优先使用 B 站接口返回的预览，否则取最早的 3 条 */
export function previewReplies(root: Comment): Comment[] {
  const subs = root.replies || []
  if (root.preview?.length) {
    const ids = new Set(root.preview)
    const list = subs.filter(s => ids.has(s.id))
    if (list.length) return list
  }
  return subs.slice(0, 3)
}

export function sortReplies(subs: Comment[], mode: SortMode): Comment[] {
  return mode === 'time'
    ? [...subs].sort((a, b) => a.ctime - b.ctime)
    : [...subs].sort((a, b) => b.like - a.like || a.ctime - b.ctime)
}

export function useCommentList(data: Ref<CommentData | null>) {
  const sort = ref<SortMode>('hot')
  const filter = ref<FilterMode>('all')
  const keyword = ref('')
  const shown = ref(PAGE)

  const ordered = computed<Comment[]>(() => {
    const d = data.value
    if (!d) return []
    const byId = new Map(d.roots.map(r => [r.id, r]))
    const order = sort.value === 'hot' ? d.orderHot : d.orderTime
    const seen = new Set<string>()
    const out: Comment[] = []
    for (const id of order) {
      const r = byId.get(id)
      if (r && !seen.has(id)) {
        seen.add(id)
        out.push(r)
      }
    }
    // 不在排序列表中的评论（如已被删除、仅存于旧存档的评论）按排序规则补在后面
    const rest = d.roots.filter(r => !seen.has(r.id))
    rest.sort((a, b) => (sort.value === 'hot' ? b.like - a.like : b.ctime - a.ctime))
    out.push(...rest)
    // 置顶评论始终在最前
    return [...out.filter(r => r.top), ...out.filter(r => !r.top)]
  })

  const items = computed<ListItem[]>(() => {
    const kw = keyword.value.trim()
    const out: ListItem[] = []
    for (const r of ordered.value) {
      if (filter.value === 'note' && !isLongComment(r)) continue
      if (!kw) {
        out.push({ root: r, matches: null })
        continue
      }
      const self = matchComment(r, kw)
      const subs = (r.replies || []).filter(s => matchComment(s, kw))
      if (self || subs.length) out.push({ root: r, matches: subs })
    }
    return out
  })

  const matchCount = computed(() =>
    items.value.reduce((n, it) => n + (matchComment(it.root, keyword.value.trim()) ? 1 : 0) + (it.matches?.length || 0), 0),
  )
  const visible = computed(() => items.value.slice(0, shown.value))
  const hasMore = computed(() => shown.value < items.value.length)
  const loadMore = () => {
    if (hasMore.value) shown.value += PAGE
  }
  watch([sort, filter, keyword], () => (shown.value = PAGE))

  /** 定位某条评论（主评论或楼中楼），确保其已渲染，返回所在主评论 */
  function locate(id: string): { root: Comment; sub: Comment | null } | null {
    const d = data.value
    if (!d) return null
    for (const r of d.roots) {
      if (r.id === id) return { root: r, sub: null }
      const s = r.replies?.find(x => x.id === id)
      if (s) return { root: r, sub: s }
    }
    return null
  }

  function reveal(rootId: string) {
    if (keyword.value) keyword.value = ''
    if (filter.value !== 'all') filter.value = 'all'
    const idx = items.value.findIndex(it => it.root.id === rootId)
    if (idx >= 0 && idx >= shown.value) shown.value = idx + PAGE
  }

  const counts = computed(() => {
    const d = data.value
    if (!d) return { roots: 0, subs: 0, total: 0, notes: 0 }
    const subs = d.roots.reduce((n, r) => n + (r.replies?.length || 0), 0)
    return {
      roots: d.roots.length,
      subs,
      total: d.roots.length + subs,
      notes: d.roots.filter(isLongComment).length,
    }
  })

  return { sort, filter, keyword, items, visible, hasMore, loadMore, matchCount, locate, reveal, counts }
}

export type CommentList = ReturnType<typeof useCommentList>

export function commentLink(bvid: string, id: string) {
  return `${location.origin}${import.meta.env.BASE_URL}video/${bvid}#reply${id}`
}

export function biliCommentLink(bvid: string, id: string) {
  return `https://www.bilibili.com/video/${bvid}/#reply${id}`
}

// ---------------------------------------------------------------- 评论组件共享上下文

export interface CommentContext {
  bvid: string
  upperMid: Ref<string>
  keyword: Ref<string>
  /** 当前高亮的评论 id */
  spotlight: Ref<string>
}

const KEY: InjectionKey<CommentContext> = Symbol('comment-context')

export function provideCommentContext(ctx: CommentContext) {
  provide(KEY, ctx)
}

export function useCommentContext(): CommentContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('comment context missing')
  return ctx
}
