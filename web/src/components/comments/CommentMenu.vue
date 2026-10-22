<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import Icon from '../Icon.vue'
import type { Comment } from '../../types'
import { copyText } from '../../composables/app'
import { biliCommentLink, commentLink, useCommentContext } from '../../composables/comments'

// 评论右侧「⋮」菜单：复制存档链接 / 复制内容 / 在 B 站查看
const props = defineProps<{ comment: Comment; mobile?: boolean }>()
const ctx = useCommentContext()
const open = ref(false)

function close() {
  open.value = false
  document.removeEventListener('click', close)
}
function toggle() {
  if (open.value) return close()
  open.value = true
  setTimeout(() => document.addEventListener('click', close))
}
onBeforeUnmount(() => document.removeEventListener('click', close))

const actions = [
  { label: '复制评论链接', run: () => copyText(commentLink(ctx.bvid, props.comment.id), '已复制存档中的评论链接') },
  { label: '复制评论内容', run: () => copyText(props.comment.msg) },
  { label: '复制用户 UID', run: () => copyText(props.comment.mid) },
  { label: '在B站中查看', run: () => window.open(biliCommentLink(ctx.bvid, props.comment.id), '_blank', 'noreferrer') },
]
</script>

<template>
  <div class="menu-wrap" :class="{ mobile, open }">
    <button class="more-btn" aria-label="更多" @click.stop="toggle"><Icon name="more" :size="mobile ? 18 : 16" /></button>
    <Transition name="fade">
      <ul v-if="open" class="options" @click.stop>
        <li v-for="a in actions" :key="a.label" @click="a.run(); close()">{{ a.label }}</li>
        <li class="meta">rpid {{ comment.id }}</li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.menu-wrap {
  position: relative;
  display: flex;
}
.more-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
}
.more-btn:hover {
  color: var(--brand_blue);
}
.options {
  position: absolute;
  right: 0;
  top: 26px;
  z-index: 20;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  min-width: 128px;
  background: var(--bg1_float);
  border-radius: 6px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  font-size: 13px;
}
.options li {
  padding: 0 15px;
  line-height: 36px;
  white-space: nowrap;
  color: var(--text1);
  cursor: pointer;
}
.options li:hover {
  background: var(--graph_bg_thick);
}
.options li.meta {
  cursor: text;
  font-size: 12px;
  line-height: 28px;
  color: var(--text3);
  user-select: all;
}
.options li.meta:hover {
  background: none;
}
.mobile .more-btn {
  color: var(--text3);
}
</style>
