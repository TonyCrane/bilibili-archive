<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

/**
 * 评论表情放大预览（全局只挂载一个，通过事件委托作用于所有 img.emote）：
 *   可悬停的设备（鼠标）：悬停显示，移开隐藏；
 *   触屏设备：点击表情显示，点击其它地方或滚动时关闭。
 */
const state = reactive({ open: false, src: '', title: '', x: 0, y: 0, below: false })
const pop = ref<HTMLElement | null>(null)
const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)')
let current: HTMLElement | null = null
let hideTimer: number | undefined

function show(img: HTMLImageElement) {
  clearTimeout(hideTimer)
  current = img
  const r = img.getBoundingClientRect()
  const half = 70
  state.src = img.currentSrc || img.src
  state.title = img.dataset.title || img.alt
  state.x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, r.left + r.width / 2))
  state.below = r.top < 210
  state.y = state.below ? r.bottom + 8 : r.top - 8
  state.open = true
}
function hide() {
  state.open = false
  current = null
}
const isEmote = (t: EventTarget | null): t is HTMLImageElement =>
  t instanceof HTMLImageElement && t.classList.contains('emote')

function onOver(e: MouseEvent) {
  if (hoverable.matches && isEmote(e.target)) show(e.target)
}
function onOut(e: MouseEvent) {
  if (hoverable.matches && isEmote(e.target)) hideTimer = window.setTimeout(hide, 80)
}
function onClick(e: MouseEvent) {
  if (isEmote(e.target)) {
    // 不让点击穿透到评论（例如打开评论详情）
    e.preventDefault()
    e.stopPropagation()
    if (state.open && current === e.target) hide()
    else show(e.target)
    return
  }
  if (state.open && !pop.value?.contains(e.target as Node)) hide()
}
function onScroll() {
  if (state.open) hide()
}

onMounted(() => {
  document.addEventListener('mouseover', onOver)
  document.addEventListener('mouseout', onOut)
  document.addEventListener('click', onClick, true)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseover', onOver)
  document.removeEventListener('mouseout', onOut)
  document.removeEventListener('click', onClick, true)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="state.open"
      ref="pop"
      class="emote-pop"
      :class="{ below: state.below }"
      :style="{ left: state.x + 'px', top: state.y + 'px' }"
    >
      <div class="title">{{ state.title }}</div>
      <img :src="state.src" :alt="state.title" />
    </div>
  </Transition>
</template>

<style scoped>
.emote-pop {
  position: fixed;
  z-index: 150;
  transform: translate(-50%, -100%);
  min-width: 112px;
  max-width: 180px;
  padding: 10px 16px 14px;
  border-radius: 8px;
  background: var(--bg1_float);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.16);
  text-align: center;
  pointer-events: none;
}
.emote-pop.below {
  transform: translate(-50%, 0);
}
.emote-pop::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  transform: rotate(45deg);
  background: var(--bg1_float);
  box-shadow: 3px 3px 5px rgba(0, 0, 0, 0.06);
}
.emote-pop.below::after {
  top: -6px;
  bottom: auto;
  box-shadow: -3px -3px 5px rgba(0, 0, 0, 0.06);
}
.title {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 18px;
  color: var(--text2);
  word-break: break-all;
}
img {
  display: block;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  object-fit: contain;
}
@media (max-width: 767px) {
  .emote-pop {
    pointer-events: auto;
  }
  img {
    width: 96px;
    height: 96px;
  }
}
</style>
