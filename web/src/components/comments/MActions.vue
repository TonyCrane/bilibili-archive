<script setup lang="ts">
import Icon from '../Icon.vue'
import CommentMenu from './CommentMenu.vue'
import type { Comment } from '../../types'
import { count, mDate, dateTime } from '../../utils/format'
import { toast } from '../../composables/app'

defineProps<{ comment: Comment; showLocation?: boolean }>()
</script>

<template>
  <div class="m-actions">
    <span class="date" :title="dateTime(comment.ctime)">{{ mDate(comment.ctime) }}</span>
    <span v-if="showLocation && comment.location" class="loc">{{ comment.location }}</span>
    <button class="reply" @click.stop="toast('这是存档页面，无法回复评论')">回复</button>
    <span v-if="comment.gone" class="gone">已删除</span>
    <span class="right">
      <button class="like"><Icon name="like" :size="17" /><span v-if="comment.like">{{ count(comment.like) }}</span></button>
      <button class="dislike"><Icon name="dislike" :size="17" /></button>
      <CommentMenu :comment="comment" mobile />
    </span>
  </div>
</template>

<style scoped>
.m-actions {
  display: flex;
  align-items: center;
  height: 28px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text3);
}
.date {
  color: var(--text2);
}
.loc {
  margin-left: 6px;
  color: var(--text2);
}
.reply {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text3);
}
.gone {
  margin-left: 8px;
  padding: 0 4px;
  border-radius: 2px;
  line-height: 16px;
  font-size: 11px;
  color: var(--warn);
  background: var(--warn_thin);
}
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}
.right button {
  display: inline-flex;
  align-items: center;
  color: var(--text3);
  font-size: 12px;
}
.like span {
  margin-left: 4px;
  min-width: 18px;
}
</style>
