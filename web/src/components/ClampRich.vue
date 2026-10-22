<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, render, watch } from 'vue'
import RichText, { snapCut, type RichComment } from './RichText'

/**
 * 评论正文的多行截断：与 B 站一致，在第 N 行末尾显示「…展开」。
 * 用隐藏的测量层二分查找能放下的最多字数，截断点不会切断表情 / 链接。
 */
const props = withDefaults(defineProps<{
  comment: RichComment
  lines?: number
  disabled?: boolean
  keyword?: string
  top?: boolean
}>(), { lines: 6, disabled: false, keyword: '', top: false })

const box = ref<HTMLElement | null>(null)
const measure = ref<HTMLElement | null>(null)
const cut = ref<number | null>(null)
const expanded = ref(false)
const pending = ref(true)
let lastWidth = 0

const shown = computed<RichComment>(() =>
  cut.value === null || expanded.value
    ? props.comment
    : { ...props.comment, msg: props.comment.msg.slice(0, cut.value).trimEnd() },
)

function heightOf(msg: string | null): number {
  const el = measure.value!
  const c = msg === null ? props.comment : { ...props.comment, msg }
  render(h('span', null, [
    props.top ? h('i', { class: 'comment-top-tag' }, '置顶') : null,
    h(RichText, { comment: c }),
    msg === null ? null : ['…', h('span', { class: 'clamp-btn' }, '展开')],
  ]), el)
  return el.offsetHeight
}

function compute() {
  const el = measure.value
  if (!el) return
  pending.value = false
  if (props.disabled) {
    cut.value = null
    return
  }
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 22
  const max = lh * props.lines + 2
  const msg = props.comment.msg
  if (heightOf(null) <= max) {
    cut.value = null
  } else {
    let lo = 0
    let hi = msg.length
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (heightOf(msg.slice(0, mid).trimEnd()) <= max) lo = mid
      else hi = mid - 1
    }
    cut.value = snapCut(props.comment, lo)
  }
  render(null, el)
}

let ro: ResizeObserver | null = null
onMounted(() => {
  compute()
  ro = new ResizeObserver(entries => {
    const w = entries[0].contentRect.width
    if (Math.abs(w - lastWidth) > 1) {
      lastWidth = w
      if (!expanded.value) compute()
    }
  })
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (measure.value) render(null, measure.value)
})
watch(() => [props.comment, props.lines, props.disabled], () => nextTick(compute))
</script>

<template>
  <div ref="box" class="clamp-rich" :class="{ pending: pending && !disabled }" :style="{ '--lines': lines }">
    <span class="clamp-text"><i v-if="top" class="comment-top-tag">置顶</i><RichText :comment="shown" :keyword="keyword" /><template v-if="cut !== null && !expanded">…<button class="clamp-btn" @click.stop="expanded = true">展开</button></template><button v-if="cut !== null && expanded" class="clamp-btn" @click.stop="expanded = false">收起</button></span>
    <div ref="measure" class="clamp-measure" aria-hidden="true" />
  </div>
</template>

<style scoped>
.clamp-rich {
  position: relative;
  white-space: pre-line;
  word-break: break-word;
}
/* 计算完成前先用 CSS 截断，避免长评论闪一下 */
.clamp-rich.pending .clamp-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--lines);
  overflow: hidden;
}
.clamp-measure {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
}
.clamp-rich :deep(.clamp-btn) {
  margin-left: 4px;
  color: var(--expand-color, var(--brand_blue));
  font-size: inherit;
  line-height: inherit;
  cursor: pointer;
}
</style>
