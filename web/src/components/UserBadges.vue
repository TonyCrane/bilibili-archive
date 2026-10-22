<script setup lang="ts">
import { computed } from 'vue'

// 等级图标（public/img/level_*.svg 取自 B 站），硬核会员显示带闪电的 LV6
const props = withDefaults(defineProps<{ level: number; senior?: boolean; up?: boolean; size?: number }>(), {
  senior: false,
  up: false,
  size: 30,
})
const hardcore = computed(() => props.senior && props.level === 6)
const src = computed(() => {
  const name = hardcore.value ? 'h' : String(Math.max(0, Math.min(6, props.level)))
  return `${import.meta.env.BASE_URL}img/level_${name}.svg`
})
// 图标画布为 30×30，但普通等级只画到 x≈21、硬核会员（带闪电）画到 x≈28.5，
// 按实际绘制宽度裁掉右侧空白，使图标与后面内容的间距一致
const width = computed(() => Math.round((props.size * (hardcore.value ? 29 : 22)) / 30))
</script>

<template>
  <img class="level" :src="src" :width="width" :height="size" :alt="`LV${level}`" :title="hardcore ? '硬核会员' : `LV${level}`" />
  <svg v-if="up" class="up" viewBox="0 0 24 24" :width="size * 0.8" :height="size * 0.8" aria-label="UP主">
    <rect x="1" y="6" width="22" height="12" rx="2.5" fill="#ff6699" />
    <text x="12" y="15.6" text-anchor="middle" fill="#fff" font-size="9.5" font-weight="700" font-family="Arial, sans-serif">UP</text>
  </svg>
</template>

<style scoped>
.level {
  flex-shrink: 0;
  display: block;
  object-fit: cover;
  object-position: left center;
  filter: var(--level-filter);
}
.up {
  flex-shrink: 0;
  display: block;
}
</style>
