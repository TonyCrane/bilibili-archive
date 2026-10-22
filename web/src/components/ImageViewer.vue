<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'
import { viewer } from '../composables/app'

const cur = computed(() => viewer.list[viewer.index])
const go = (d: number) => {
  const n = viewer.list.length
  viewer.index = (viewer.index + d + n) % n
}
const close = () => (viewer.open = false)

function onKey(e: KeyboardEvent) {
  if (!viewer.open) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
}
let x0 = 0
const touchStart = (e: TouchEvent) => (x0 = e.touches[0].clientX)
function touchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - x0
  if (Math.abs(dx) > 50 && viewer.list.length > 1) go(dx < 0 ? 1 : -1)
}

watch(() => viewer.open, open => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="fade">
    <div v-if="viewer.open && cur" class="viewer" @click="close" @touchstart.passive="touchStart" @touchend="touchEnd">
      <img class="img" :src="cur.src" alt="" @click.stop />
      <button class="close" aria-label="关闭" @click.stop="close"><Icon name="close" :size="22" /></button>
      <template v-if="viewer.list.length > 1">
        <button class="nav prev" aria-label="上一张" @click.stop="go(-1)"><Icon name="left" :size="26" /></button>
        <button class="nav next" aria-label="下一张" @click.stop="go(1)"><Icon name="right" :size="26" /></button>
      </template>
      <div class="bar" @click.stop>
        <span v-if="viewer.list.length > 1">{{ viewer.index + 1 }} / {{ viewer.list.length }}</span>
        <a :href="cur.src" target="_blank" rel="noreferrer">查看原图</a>
        <a :href="cur.remote" target="_blank" rel="noreferrer">B站图床地址</a>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  cursor: zoom-out;
}
.img {
  max-width: 92vw;
  max-height: calc(100vh - 110px);
  object-fit: contain;
  cursor: default;
  user-select: none;
}
.close,
.nav {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}
.close {
  top: calc(16px + env(safe-area-inset-top));
  right: 16px;
  width: 40px;
  height: 40px;
}
.nav {
  top: 50%;
  width: 48px;
  height: 48px;
  margin-top: -24px;
}
.close:hover,
.nav:hover {
  background: rgba(255, 255, 255, 0.24);
}
.prev {
  left: 20px;
}
.next {
  right: 20px;
}
.bar {
  position: absolute;
  bottom: calc(20px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 18px;
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 13px;
  color: #ddd;
  background: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  cursor: default;
}
.bar a {
  color: #fff;
}
.bar a:hover {
  color: var(--brand_blue);
}
@media (max-width: 767px) {
  .nav {
    display: none;
  }
  .img {
    max-width: 100vw;
  }
}
</style>
