<script setup lang="ts">
import Icon from '../Icon.vue'
import CommentMenu from './CommentMenu.vue'
import type { Comment } from '../../types'
import { dateTime } from '../../utils/format'
import { toast } from '../../composables/app'

defineProps<{ comment: Comment }>()
</script>

<template>
  <div class="actions">
    <div class="pubdate" :title="`rpid: ${comment.id}`">{{ dateTime(comment.ctime) }}</div>
    <div v-if="comment.location" class="location">IP属地：{{ comment.location }}</div>
    <button class="like" title="点赞数（存档时）"><Icon name="like" /><span v-if="comment.like">{{ comment.like }}</span></button>
    <button class="dislike"><Icon name="dislike" /></button>
    <button class="reply" @click="toast('这是存档页面，无法回复评论')">回复</button>
    <span v-if="comment.gone" class="gone" :title="`${comment.gone} 抓取时已无法在原视频中找到`">已删除</span>
    <CommentMenu class="more" :comment="comment" />
  </div>
</template>

<style scoped>
.actions {
  width: 100%;
  display: flex;
  align-items: center;
  position: relative;
  margin-top: 3px;
  font-size: 13px;
  color: var(--text3);
}
.actions > :not(:first-child) {
  margin-left: 20px;
}
.actions .location {
  margin-left: 12px;
}
button {
  height: 24px;
  font-size: 13px;
  color: var(--text3);
  display: inline-flex;
  align-items: center;
}
button:hover {
  color: var(--brand_blue);
}
button span {
  margin-left: 5px;
}
.gone {
  padding: 0 6px;
  border-radius: 3px;
  line-height: 18px;
  font-size: 12px;
  color: var(--warn);
  background: var(--warn_thin);
}
.more {
  margin-left: auto !important;
  margin-right: 20px;
  visibility: var(--hover-more, hidden);
}
.more.open {
  visibility: visible;
}
</style>
