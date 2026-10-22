<script setup lang="ts">
import { computed } from 'vue'
import type { Picture } from '../types'
import { openViewer } from '../composables/app'

const props = withDefaults(defineProps<{ pics: Picture[]; mobile?: boolean }>(), { mobile: false })

// 单图按原比例显示（限制在 3:4 ~ 4:3 之间并裁切），多图为正方形网格
const single = computed(() => {
  if (props.pics.length !== 1) return null
  const p = props.pics[0]
  const ratio = p.w && p.h ? p.w / p.h : 1
  const r = Math.min(4 / 3, Math.max(3 / 4, ratio))
  const long = props.mobile ? 170 : 180
  return { width: Math.round(long * r), height: long }
})
const longPic = (p: Picture) => p.w && p.h && p.h / p.w > 3
</script>

<template>
  <div class="pics" :class="[{ mobile }, `n${Math.min(pics.length, 4)}`]">
    <div
      v-for="(p, i) in pics.slice(0, 9)"
      :key="i"
      class="pic"
      :style="single ? { width: single.width + 'px', height: single.height + 'px' } : undefined"
      @click.stop="openViewer(pics, i)"
    >
      <img :src="p.src" loading="lazy" alt="评论图片" />
      <span v-if="longPic(p)" class="tag">长图</span>
      <span v-else-if="/\.gif$/i.test(p.remote)" class="tag">动图</span>
      <span v-if="i === 8 && pics.length > 9" class="more">+{{ pics.length - 9 }}</span>
    </div>
  </div>
</template>

<style scoped>
.pics {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(3, 118px);
  max-width: 364px;
}
.pics.n1 {
  display: flex;
}
.pics.n2,
.pics.n4 {
  grid-template-columns: repeat(2, 118px);
}
.pic {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 6px;
  cursor: zoom-in;
  background: var(--graph_bg_regular);
}
.n1 .pic {
  aspect-ratio: auto;
}
.pic img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tag,
.more {
  position: absolute;
  right: 4px;
  bottom: 4px;
  height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.more {
  inset: 0;
  height: auto;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: rgba(0, 0, 0, 0.45);
}

/* 移动端：多图拼接在一起，只有外侧圆角 */
.mobile {
  gap: 2px;
  max-width: 100%;
  grid-template-columns: repeat(3, 1fr);
  width: min(100%, 300px);
  border-radius: 6px;
  overflow: hidden;
}
.mobile.n1 {
  width: auto;
  overflow: visible;
}
.mobile.n2,
.mobile.n4 {
  grid-template-columns: repeat(2, 1fr);
  width: min(100%, 240px);
}
.mobile .pic {
  border-radius: 0;
}
.mobile.n1 .pic {
  border-radius: 6px;
}
</style>
