<script setup lang="ts">
import ImageViewer from './components/ImageViewer.vue'
import EmotePopover from './components/EmotePopover.vue'
import { toastState } from './composables/app'
</script>

<template>
  <RouterView :key="$route.path" />
  <ImageViewer />
  <EmotePopover />
  <Transition name="fade">
    <div v-if="toastState.visible" class="toast">{{ toastState.text }}</div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 200;
  transform: translate(-50%, -50%);
  max-width: 80vw;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  pointer-events: none;
}
</style>
