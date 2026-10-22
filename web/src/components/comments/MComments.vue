<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import MComment from './MComment.vue'
import MCommentDetail from './MCommentDetail.vue'
import type { Comment } from '../../types'
import type { CommentList } from '../../composables/comments'
import { useInfinite } from '../../composables/app'

const props = defineProps<{ list: CommentList }>()
const { sort, filter, keyword, visible, hasMore, loadMore, items, matchCount, counts } = props.list
const { el: sentinel, start } = useInfinite(loadMore)
onMounted(start)
watch(visible, () => setTimeout(start))

const detail = ref<{ comment: Comment; focus?: string } | null>(null)
function open(comment: Comment, focus?: string) {
  detail.value = { comment, focus }
}
defineExpose({ open })
watch(detail, d => (document.body.style.overflow = d ? 'hidden' : ''))
onBeforeUnmount(() => (document.body.style.overflow = ''))

const chips = [
  { key: 'all', label: '全部' },
  { key: 'note', label: '笔记长评' },
] as const
const input = ref<HTMLInputElement | null>(null)
</script>

<template>
  <div class="m-comments">
    <div class="chips">
      <button
        v-for="c in chips"
        :key="c.key"
        class="chip"
        :class="{ active: filter === c.key }"
        :disabled="c.key === 'note' && !counts.notes"
        @click="filter = c.key"
      >{{ c.label }}</button>
      <button class="sort" @click="sort = sort === 'hot' ? 'time' : 'hot'">
        <Icon name="sort" :size="14" />{{ sort === 'hot' ? '按热度' : '按时间' }}
      </button>
    </div>
    <div v-if="keyword" class="search-tip">
      找到 <b>{{ matchCount }}</b> 条相关评论
      <button @click="keyword = ''">清除</button>
    </div>

    <MComment v-for="it in visible" :key="it.root.id" :comment="it.root" :matches="it.matches" @open="open" />
    <div ref="sentinel" class="end">
      <template v-if="hasMore">正在加载…</template>
      <template v-else-if="items.length">没有更多评论</template>
      <template v-else-if="keyword">没有找到相关评论</template>
      <template v-else>还没有评论存档</template>
    </div>

    <div class="reply-bar">
      <label class="input">
        <input ref="input" v-model.trim="keyword" type="search" enterkeyhint="search" placeholder="搜索存档评论 · 内容 / 用户名 / UID" @keydown.enter="input?.blur()" />
      </label>
      <button class="emoji" aria-label="清除搜索" @click="keyword ? (keyword = '') : input?.focus()">
        <Icon :name="keyword ? 'close' : 'emoji'" :size="keyword ? 20 : 26" />
      </button>
    </div>

    <Transition name="slide">
      <MCommentDetail v-if="detail" :key="detail.comment.id" :comment="detail.comment" :focus="detail.focus" @close="detail = null" />
    </Transition>
  </div>
</template>

<style scoped>
.m-comments {
  padding-bottom: calc(64px + env(safe-area-inset-bottom));
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 2px;
}
.chip {
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 14px;
  color: var(--text2);
}
.chip.active {
  color: var(--brand_pink);
  background: var(--graph_bg_regular);
}
.chip:disabled {
  opacity: 0.4;
}
.sort {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--text2);
}
.search-tip {
  margin: 8px 12px 0;
  font-size: 13px;
  color: var(--text2);
}
.search-tip b {
  color: var(--brand_pink);
  font-weight: 500;
}
.search-tip button {
  margin-left: 6px;
  color: var(--m_link);
  font-size: 13px;
}
.end {
  padding: 18px 0 24px;
  text-align: center;
  font-size: 12px;
  color: var(--text3);
}
.reply-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px calc(7px + env(safe-area-inset-bottom)) 10px;
  background: var(--bg1);
  border-top: 0.5px solid var(--line_regular);
}
.input {
  flex: 1;
  display: flex;
  height: 36px;
  border-radius: 18px;
  background: var(--graph_bg_regular);
}
.input input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 14px;
  font-size: 15px;
  color: var(--text1);
}
.input input::placeholder {
  color: var(--text3);
}
.input input::-webkit-search-cancel-button {
  display: none;
}
.emoji {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
}
</style>
