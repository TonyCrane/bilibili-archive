<script setup lang="ts">
import { computed } from 'vue'
import { thumb, spaceUrl } from '../utils/format'

const props = withDefaults(defineProps<{
  face: string
  size?: number
  mid?: string
  pendant?: string
  vip?: boolean
  official?: number
  /** 是否显示头像框 / 角标 */
  decorate?: boolean
}>(), { size: 48, mid: '', pendant: '', vip: false, official: -1, decorate: true })

const hasPendant = computed(() => props.decorate && !!props.pendant)
// 与 B 站头像组件一致：有头像框时头像缩小到 0.787，头像框为 1.375 倍
const faceSize = computed(() => (hasPendant.value ? Math.round(props.size * 0.787) : props.size))
const badge = computed(() => {
  if (!props.decorate) return ''
  if (props.official === 0) return 'personal'
  if (props.official === 1) return 'org'
  return props.vip ? 'vip' : ''
})
const badgeSize = computed(() => Math.max(12, Math.round(props.size * 0.3)))
const px = (v: number) => Math.min(240, Math.ceil((v * 2) / 24) * 24)
</script>

<template>
  <component
    :is="mid ? 'a' : 'span'"
    class="bili-avatar"
    :href="mid ? spaceUrl(mid) : undefined"
    :target="mid ? '_blank' : undefined"
    rel="noreferrer"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <img
      class="face"
      :src="thumb(face, px(faceSize), px(faceSize))"
      :width="faceSize"
      :height="faceSize"
      loading="lazy"
      alt=""
    />
    <img
      v-if="hasPendant"
      class="pendant"
      :src="thumb(pendant, px(size * 1.375))"
      :style="{ width: size * 1.375 + 'px', height: size * 1.375 + 'px' }"
      loading="lazy"
      alt=""
    />
    <span v-if="badge" class="badge" :class="badge" :style="{ width: badgeSize + 'px', height: badgeSize + 'px' }">
      <svg v-if="badge === 'vip'" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#fb7299" /><path d="M4.5 6.2h7M8 3.8v2.4c0 2.4-1.2 4.6-3.6 6M8 6.8c.5 2.5 1.8 4.3 3.7 5.2" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" /></svg>
      <svg v-else viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" :fill="badge === 'org' ? '#4ba5e8' : '#fdb02a'" /><path d="M9.2 3.2 5.2 8.6h2.6l-1 4.2 4-5.4H8.2l1-4.2z" fill="#fff" /></svg>
    </span>
  </component>
</template>

<style scoped>
.bili-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.face {
  border-radius: 50%;
  object-fit: cover;
  background: var(--graph_bg_regular);
  display: block;
}
.pendant {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  max-width: none;
}
.badge {
  position: absolute;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px var(--bg1);
  line-height: 0;
}
.badge svg {
  width: 100%;
  height: 100%;
}
</style>
