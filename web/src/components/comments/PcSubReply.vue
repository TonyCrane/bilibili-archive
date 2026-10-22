<script setup lang="ts">
import Avatar from '../Avatar.vue'
import UserBadges from '../UserBadges.vue'
import RichText from '../RichText'
import Pictures from '../Pictures.vue'
import PcActions from './PcActions.vue'
import type { Comment } from '../../types'
import { spaceUrl } from '../../utils/format'
import { useCommentContext } from '../../composables/comments'

defineProps<{ comment: Comment }>()
const ctx = useCommentContext()
</script>

<template>
  <div :id="`reply${comment.id}`" class="sub-reply" :class="{ spotlight: ctx.spotlight.value === comment.id, gone: comment.gone }">
    <div class="main">
      <span class="user-info">
        <Avatar class="user-avatar" :face="comment.user.face" :mid="comment.mid" :size="24" :decorate="false" />
        <a class="user-name" :href="spaceUrl(comment.mid)" target="_blank" rel="noreferrer" :style="{ color: comment.user.vip.nameColor || undefined }">{{ comment.user.name }}</a>
        <UserBadges :level="comment.user.level" :senior="comment.user.senior" :up="comment.mid === ctx.upperMid.value" />
      </span>
      <RichText class="text" :comment="comment" :keyword="ctx.keyword.value" />
    </div>
    <Pictures v-if="comment.pics.length" class="pics" :pics="comment.pics" />
    <PcActions :comment="comment" />
  </div>
</template>

<style scoped>
.sub-reply {
  position: relative;
  scroll-margin-top: 80px;
  padding: 8px 0 8px 34px;
  border-radius: 4px;
  --hover-more: hidden;
}
.sub-reply:hover {
  --hover-more: visible;
}
.sub-reply.spotlight {
  background: var(--brand_blue_thin);
}
.sub-reply.gone .main {
  opacity: 0.7;
}
.main {
  font-size: 15px;
  line-height: 24px;
  color: var(--text1);
  white-space: pre-line;
  word-break: break-word;
}
.user-info {
  display: inline-flex;
  align-items: center;
  vertical-align: top;
  height: 24px;
  margin-right: 9px;
  white-space: normal;
}
.user-avatar {
  position: absolute;
  left: 0;
  top: 8px;
}
.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
}
.user-info :deep(.level) {
  margin-left: 5px;
}
.pics {
  margin-top: 6px;
}
</style>
