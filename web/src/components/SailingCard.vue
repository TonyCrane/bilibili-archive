<script setup lang="ts">
import type { SailingCard } from '../types'
import { loadFanFont } from '../composables/app'

// 评论区右上角的装扮粉丝卡片（如「NO. 000001」）
withDefaults(defineProps<{ card: SailingCard; height?: number }>(), { height: 48 })
loadFanFont()
</script>

<template>
  <a class="sailing" :href="card.jumpUrl || undefined" target="_blank" rel="noreferrer" :title="card.name" :style="{ height: height + 'px' }" @click.stop>
    <img :src="card.image" :style="{ height: height + 'px' }" alt="" loading="lazy" />
    <span v-if="card.num" class="fan" :class="{ pc: height >= 40 }" :style="{ backgroundImage: card.gradient || undefined }">
      <span>{{ card.prefix }}</span>
      <span>{{ card.num }}</span>
    </span>
  </a>
</template>

<style scoped>
.sailing {
  position: relative;
  display: inline-block;
  max-width: 288px;
  overflow: hidden;
  user-select: none;
}
.sailing img {
  display: block;
  width: auto;
  object-fit: cover;
}
.fan {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  font-family: 'fans-num', sans-serif;
  font-size: 8px;
  line-height: 10px;
  color: transparent;
  background-color: #b8c7d0;
  -webkit-background-clip: text;
  background-clip: text;
}
.fan.pc {
  /* 与网页端一致：13px 字号缩放 0.7 */
  font-size: 13px;
  line-height: 16px;
  transform: scale(0.7);
  transform-origin: center center;
}
</style>
