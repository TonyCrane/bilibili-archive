<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '../Avatar.vue'
import UserBadges from '../UserBadges.vue'
import ClampRich from '../ClampRich.vue'
import Pictures from '../Pictures.vue'
import SailingCard from '../SailingCard.vue'
import MActions from './MActions.vue'
import type { Comment } from '../../types'
import { spaceUrl } from '../../utils/format'
import { previewReplies, useCommentContext } from '../../composables/comments'

/**
 * App 风格的评论：
 *  variant=root    评论列表中的主评论（带楼中楼预览）
 *  variant=detail  评论详情页顶部的主评论（不截断）
 *  variant=sub     评论详情页中的楼中楼（小头像）
 */
const props = withDefaults(defineProps<{
  comment: Comment
  matches?: Comment[] | null
  variant?: 'root' | 'detail' | 'sub'
}>(), { matches: null, variant: 'root' })
const emit = defineEmits<{ open: [comment: Comment, focus?: string] }>()
const ctx = useCommentContext()
const c = computed(() => props.comment)
const preview = computed(() => (props.matches ? props.matches : previewReplies(c.value).slice(0, 2)))
const total = computed(() => Math.max(c.value.rcount, c.value.replies?.length || 0))
const avatarSize = computed(() => (props.variant === 'sub' ? 30 : 36))
</script>

<template>
  <div
    :id="`reply${c.id}`"
    class="m-reply"
    :class="[`is-${variant}`, { spotlight: ctx.spotlight.value === c.id, gone: c.gone }]"
  >
    <Avatar
      class="avatar"
      :face="c.user.face"
      :mid="c.mid"
      :size="avatarSize"
      :pendant="c.user.pendant"
      :vip="c.user.vip.subscript"
      :official="c.user.official"
    />
    <div class="main">
      <div class="head">
        <a class="name" :href="spaceUrl(c.mid)" target="_blank" rel="noreferrer" :style="{ color: c.user.vip.nameColor || undefined }">{{ c.user.name }}</a>
        <UserBadges :level="c.user.level" :senior="c.user.senior" :up="c.mid === ctx.upperMid.value" :size="26" />
        <SailingCard v-if="c.user.card && variant !== 'sub'" class="card" :card="c.user.card" :height="30" />
      </div>
      <div class="content" @click="variant === 'root' && c.replies?.length && emit('open', c)">
        <ClampRich :comment="c" :lines="c.maxLine" :top="c.top" :keyword="ctx.keyword.value" :disabled="variant === 'detail' || !!ctx.keyword.value" />
      </div>
      <Pictures v-if="c.pics.length" class="pics" :pics="c.pics" mobile />
      <MActions :comment="c" :show-location="true" />
      <div v-if="c.labels.length || c.orphan" class="labels">
        <span v-if="c.orphan" class="label">原评论已删除，此为楼中楼回复</span>
        <span v-for="l in c.labels" :key="l.text" class="label" :style="{ '--c': l.color, '--b': l.bg, '--cd': l.colorDark, '--bd': l.bgDark }">{{ l.text }}</span>
      </div>

      <template v-if="variant === 'root' && c.replies?.length">
        <div v-if="preview.length" class="subs" @click="emit('open', c)">
          <div v-for="s in preview" :key="s.id" class="sub" :class="{ spotlight: ctx.spotlight.value === s.id }" @click.stop="emit('open', c, s.id)">
            <div class="sub-name">
              <a :href="spaceUrl(s.mid)" target="_blank" rel="noreferrer" @click.stop>{{ s.user.name }}</a>
              <UserBadges v-if="s.mid === ctx.upperMid.value" :level="s.user.level" :senior="s.user.senior" up :size="22" class="sub-badges" />
            </div>
            <div class="sub-content">
              <ClampRich :comment="s" :lines="2" :keyword="ctx.keyword.value" :disabled="!!ctx.keyword.value" />
            </div>
            <Pictures v-if="s.pics.length" class="pics" :pics="s.pics" mobile />
            <MActions :comment="s" />
          </div>
        </div>
        <button v-if="total > preview.length || matches" class="more-replies" @click="emit('open', c)">
          共{{ total }}条回复
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.m-reply {
  position: relative;
  scroll-margin-top: 56px;
  padding: 12px 12px 0 56px;
  --expand-color: var(--m_link);
}
.m-reply.spotlight {
  background: var(--brand_blue_thin);
}
.m-reply.gone .content,
.m-reply.gone .pics {
  opacity: 0.7;
}
.avatar {
  position: absolute;
  left: 9px;
  top: 12px;
}
.main {
  padding-bottom: 10px;
  border-bottom: 0.5px solid var(--line_regular);
}
.is-detail .main,
.is-sub .main {
  border-bottom: none;
}
.head {
  position: relative;
  display: flex;
  align-items: center;
  height: 26px;
  margin-bottom: 2px;
}
.name {
  font-size: 13px;
  color: var(--text2);
  max-width: 55%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-right: 3px;
}
.card {
  position: absolute;
  right: 0;
  top: -4px;
}
.content {
  font-size: 15px;
  line-height: 22px;
  color: var(--text1);
}
.is-detail .content {
  font-size: 16px;
  line-height: 24px;
}
.pics {
  margin-top: 8px;
}
.labels {
  margin: 6px 0 2px;
}
.label {
  display: inline-block;
  padding: 2px 5px;
  border-radius: 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--c, var(--text3));
  background: var(--b, var(--bg3));
}
:root[data-theme='dark'] .label {
  color: var(--cd, var(--text3));
  background: var(--bd, var(--bg3));
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .label {
    color: var(--cd, var(--text3));
    background: var(--bd, var(--bg3));
  }
}
.subs {
  margin-top: 8px;
  padding-left: 9px;
  border-left: 2px solid var(--line_regular);
}
.sub {
  padding: 2px 0;
}
.sub.spotlight {
  background: var(--brand_blue_thin);
}
.sub-name {
  display: flex;
  align-items: center;
  font-size: 13px;
  line-height: 20px;
  color: var(--text3);
}
.sub-badges {
  margin-left: 2px;
}
.sub-content {
  margin-top: 2px;
  font-size: 15px;
  line-height: 22px;
  color: var(--text1);
}
.more-replies {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 8px;
  height: 30px;
  padding: 0 10px 0 12px;
  border-radius: 15px;
  font-size: 13px;
  color: var(--text1);
  background: var(--graph_bg_regular);
}
</style>
