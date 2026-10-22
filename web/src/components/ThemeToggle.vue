<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { cycleTheme, theme } from '../composables/app'

defineProps<{ light?: boolean }>()
const label = computed(() => ({ auto: '跟随系统', light: '浅色模式', dark: '深色模式' })[theme.mode])
const icon = computed(() => ({ auto: 'auto', light: 'sun', dark: 'moon' })[theme.mode])
</script>

<template>
  <button class="theme-toggle" :class="{ light }" :title="`主题：${label}（点击切换）`" :aria-label="`主题：${label}`" @click="cycleTheme">
    <Icon :name="icon" :size="18" />
  </button>
</template>

<style scoped>
.theme-toggle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
}
.theme-toggle:hover {
  background: var(--graph_bg_regular);
  color: var(--text1);
}
.theme-toggle.light {
  color: #fff;
}
.theme-toggle.light:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
