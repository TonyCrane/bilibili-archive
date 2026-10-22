import { defineComponent, h, type PropType, type VNode } from 'vue'
import type { Comment } from '../types'
import { spaceUrl } from '../utils/format'

export type RichComment = Pick<Comment, 'msg' | 'emote' | 'at' | 'jump'>

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const URL_RE = String.raw`https?:\/\/[^\s，。！？、“”"'<>（）()]+`

/** 正文中需要特殊渲染的片段（表情 / @ / 跳转关键词 / 链接） */
export function tokenRegExp(c: RichComment): RegExp {
  const keys = [
    ...Object.keys(c.emote),
    ...Object.keys(c.at).map(n => '@' + n),
    ...Object.keys(c.jump),
  ].filter(Boolean).sort((a, b) => b.length - a.length)
  return new RegExp([...keys.map(escapeRe), URL_RE].join('|'), 'g')
}

/** 把截断位置调整到不会切断表情 / 链接等片段的地方 */
export function snapCut(c: RichComment, n: number): number {
  for (const m of c.msg.matchAll(tokenRegExp(c))) {
    const i = m.index ?? 0
    if (i >= n) break
    if (i + m[0].length > n) return i
  }
  return n
}

function highlight(text: string, kw: string): (string | VNode)[] {
  if (!kw) return [text]
  const out: (string | VNode)[] = []
  const lower = text.toLowerCase()
  const k = kw.toLowerCase()
  let i = 0
  for (;;) {
    const j = lower.indexOf(k, i)
    if (j < 0) break
    if (j > i) out.push(text.slice(i, j))
    out.push(h('mark', text.slice(j, j + k.length)))
    i = j + k.length
  }
  if (i < text.length) out.push(text.slice(i))
  return out
}

const isLinkKey = (k: string) => /^(https?:)?\/\//.test(k) || /^(BV[0-9A-Za-z]{10}|av\d+)$/i.test(k)

/** 渲染评论正文：表情、@用户、关键词 / 视频跳转、链接、搜索高亮 */
export default defineComponent({
  name: 'RichText',
  props: {
    comment: { type: Object as PropType<RichComment>, required: true },
    keyword: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const { msg, emote, at, jump } = props.comment
      const nodes: (string | VNode)[] = []
      let last = 0
      for (const m of msg.matchAll(tokenRegExp(props.comment))) {
        const t = m[0]
        const idx = m.index ?? 0
        if (idx > last) nodes.push(...highlight(msg.slice(last, idx), props.keyword))
        last = idx + t.length
        if (emote[t]) {
          // 悬停 / 点击放大由全局的 EmotePopover 处理
          nodes.push(h('img', {
            class: 'emote',
            src: emote[t].url,
            alt: t,
            'data-title': emote[t].title,
            loading: 'lazy',
          }))
        } else if (t.startsWith('@') && at[t.slice(1)]) {
          nodes.push(h('a', { class: 'link', href: spaceUrl(at[t.slice(1)]), target: '_blank', rel: 'noreferrer' }, highlight(t, props.keyword)))
        } else if (jump[t]) {
          const j = jump[t]
          if (isLinkKey(t)) {
            const href = j.url || (t.startsWith('http') || t.startsWith('//') ? t : `https://www.bilibili.com/video/${t}`)
            nodes.push(h('a', { class: 'link jump', href, target: '_blank', rel: 'noreferrer' }, [
              j.icon ? h('img', { class: 'jump-icon', src: j.icon, alt: '' }) : null,
              j.title,
            ]))
          } else {
            const href = j.url || `https://search.bilibili.com/all?keyword=${encodeURIComponent(t)}`
            nodes.push(h('a', { class: 'link search', href, target: '_blank', rel: 'noreferrer' }, [
              ...highlight(j.title || t, props.keyword),
              j.icon ? h('img', { class: 'search-icon', src: j.icon, alt: '' }) : null,
            ]))
          }
        } else {
          nodes.push(h('a', { class: 'link', href: t, target: '_blank', rel: 'noreferrer' }, highlight(t, props.keyword)))
        }
      }
      if (last < msg.length) nodes.push(...highlight(msg.slice(last), props.keyword))
      return h('span', { class: 'rich-text' }, nodes)
    }
  },
})
