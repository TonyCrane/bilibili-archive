<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import MComment from './MComment.vue'
import type { Comment } from '../../types'
import { sortReplies, useCommentContext, type SortMode } from '../../composables/comments'
import { useInfinite } from '../../composables/app'

// App 的「评论详情」页：主评论 + 全部回复
const props = defineProps<{ comment: Comment; focus?: string }>()
const emit = defineEmits<{ close: [] }>()
const ctx = useCommentContext()
const sort = ref<SortMode>('time')
const shown = ref(20)
const subs = computed(() => sortReplies(props.comment.replies || [], sort.value))
const visible = computed(() => subs.value.slice(0, shown.value))
const total = computed(() => Math.max(props.comment.rcount, subs.value.length))
const { el: sentinel, start } = useInfinite(() => {
  if (shown.value < subs.value.length) shown.value += 20
})
const scroller = ref<HTMLElement | null>(null)

watch(sort, () => {
  shown.value = 20
  scroller.value?.scrollTo({ top: 0 })
})
watch(visible, () => setTimeout(start))

onMounted(async () => {
  start()
  if (props.focus) {
    const i = subs.value.findIndex(s => s.id === props.focus)
    if (i >= shown.value) shown.value = i + 10
    ctx.spotlight.value = props.focus
    await nextTick()
    document.getElementById(`reply${props.focus}`)?.scrollIntoView({ block: 'center' })
  }
})
</script>

<template>
  <div class="detail-panel">
    <header class="bar">
      <button class="back" aria-label="返回" @click="emit('close')"><Icon name="back" :size="22" /></button>
      <span class="title">评论详情</span>
    </header>
    <div ref="scroller" class="scroller">
      <MComment :comment="comment" variant="detail" />
      <div class="sub-head">
        <span>相关回复共{{ total }}条</span>
        <button class="sort" @click="sort = sort === 'time' ? 'hot' : 'time'">
          <Icon name="sort" :size="14" />{{ sort === 'time' ? '按时间' : '按热度' }}
        </button>
      </div>
      <MComment v-for="s in visible" :key="s.id" :comment="s" variant="sub" />
      <div ref="sentinel" class="end">{{ shown < subs.length ? '正在加载…' : subs.length ? '没有更多了' : '暂无回复' }}</div>
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--bg1);
}
.bar {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding-top: env(safe-area-inset-top);
  box-sizing: content-box;
  border-bottom: 0.5px solid var(--line_regular);
}
.back {
  position: absolute;
  left: 6px;
  bottom: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text1);
}
.title {
  font-size: 16px;
  font-weight: 500;
}
.scroller {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: env(safe-area-inset-bottom);
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  border-top: 8px solid var(--bg2);
  font-size: 14px;
  color: var(--text1);
}
.sort {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--text2);
}
.end {
  padding: 18px 0 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text3);
}
</style>
