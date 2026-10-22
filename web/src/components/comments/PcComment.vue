<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Avatar from '../Avatar.vue'
import UserBadges from '../UserBadges.vue'
import ClampRich from '../ClampRich.vue'
import Pictures from '../Pictures.vue'
import SailingCard from '../SailingCard.vue'
import PcActions from './PcActions.vue'
import PcSubReply from './PcSubReply.vue'
import type { Comment } from '../../types'
import { spaceUrl } from '../../utils/format'
import { previewReplies, sortReplies, useCommentContext } from '../../composables/comments'

const SUB_PAGE = 10
const props = defineProps<{ comment: Comment; matches: Comment[] | null; openSub?: string }>()
const ctx = useCommentContext()
const c = computed(() => props.comment)

// 楼中楼：默认显示预览，点击查看后分页（每页 10 条，按时间顺序，与 B 站网页端一致）
const expanded = ref(false)
const page = ref(1)
const allSubs = computed(() => sortReplies(c.value.replies || [], 'time'))
const pages = computed(() => Math.max(1, Math.ceil(allSubs.value.length / SUB_PAGE)))
const preview = computed(() => previewReplies(c.value))
const shownSubs = computed(() => {
  if (props.matches && !expanded.value) return props.matches
  if (expanded.value) return allSubs.value.slice((page.value - 1) * SUB_PAGE, page.value * SUB_PAGE)
  return preview.value
})
const total = computed(() => Math.max(c.value.rcount, allSubs.value.length))
const pageList = computed(() => {
  const n = pages.value
  const p = page.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const set = new Set([1, n, p - 1, p, p + 1, p - 2, p + 2].filter(x => x >= 1 && x <= n))
  const arr = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  arr.forEach((x, i) => {
    if (i && x - arr[i - 1] > 1) out.push('…')
    out.push(x)
  })
  return out
})

const root = ref<HTMLElement | null>(null)
function goPage(p: number) {
  page.value = p
  expanded.value = true
  root.value?.querySelector('.replies')?.scrollIntoView({ block: 'nearest' })
}
function collapse() {
  expanded.value = false
  page.value = 1
  root.value?.scrollIntoView({ block: 'nearest' })
}

// 定位到某条楼中楼时自动翻到所在页
watch(
  () => props.openSub,
  id => {
    if (!id) return
    const i = allSubs.value.findIndex(s => s.id === id)
    if (i >= 0 && !preview.value.some(s => s.id === id)) {
      expanded.value = true
      page.value = Math.floor(i / SUB_PAGE) + 1
    }
  },
  { immediate: true },
)
</script>

<template>
  <div ref="root" class="thread" :id="`reply${c.id}`">
    <div class="body" :class="{ spotlight: ctx.spotlight.value === c.id, gone: c.gone }">
      <Avatar
        class="user-avatar"
        :face="c.user.face"
        :mid="c.mid"
        :size="48"
        :pendant="c.user.pendant"
        :vip="c.user.vip.subscript"
        :official="c.user.official"
      />
      <div class="main">
        <div class="header">
          <div class="user-info">
            <a class="user-name" :href="spaceUrl(c.mid)" target="_blank" rel="noreferrer" :style="{ color: c.user.vip.nameColor || undefined }">{{ c.user.name }}</a>
            <UserBadges :level="c.user.level" :senior="c.user.senior" :up="c.mid === ctx.upperMid.value" />
          </div>
          <div v-if="c.user.card" class="ornament"><SailingCard :card="c.user.card" :height="48" /></div>
        </div>
        <div class="content">
          <ClampRich :comment="c" :lines="c.maxLine" :top="c.top" :keyword="ctx.keyword.value" :disabled="!!ctx.keyword.value" />
        </div>
        <Pictures v-if="c.pics.length" class="pictures" :pics="c.pics" />
        <div v-if="c.labels.length || c.orphan" class="tags">
          <span v-if="c.orphan" class="tag">原评论已删除，此为楼中楼回复</span>
          <span v-for="l in c.labels" :key="l.text" class="tag" :style="{ '--c': l.color, '--b': l.bg, '--cd': l.colorDark, '--bd': l.bgDark }">{{ l.text }}</span>
        </div>
        <PcActions :comment="c" />
      </div>
    </div>

    <div v-if="allSubs.length" class="replies">
      <PcSubReply v-for="s in shownSubs" :key="s.id" :comment="s" />
      <div class="replies-footer">
        <template v-if="matches && !expanded">
          <span v-if="matches.length" class="view-more">{{ matches.length }} 条回复包含关键词，</span>
          <button v-if="total > matches.length" class="text-btn" @click="goPage(1)">查看全部 {{ total }} 条回复</button>
        </template>
        <template v-else-if="!expanded">
          <template v-if="total > preview.length">
            <span class="view-more">共{{ total }}条回复，</span>
            <button class="text-btn" @click="goPage(1)">点击查看</button>
          </template>
        </template>
        <div v-else class="pagination">
          <span v-if="pages > 1" class="pagination-head">共{{ pages }}页</span>
          <template v-if="pages > 1">
            <button v-if="page > 1" class="text-btn" @click="goPage(page - 1)">上一页</button>
            <template v-for="(p, i) in pageList" :key="i">
              <span v-if="p === '…'" class="ellipsis-dot">…</span>
              <button v-else class="text-btn num" :class="{ active: p === page }" @click="goPage(p)">{{ p }}</button>
            </template>
            <button v-if="page < pages" class="text-btn" @click="goPage(page + 1)">下一页</button>
          </template>
          <button class="text-btn" @click="collapse">收起</button>
        </div>
      </div>
    </div>
    <div class="divider" />
  </div>
</template>

<style scoped>
.thread {
  position: relative;
  scroll-margin-top: 80px;
}
.body {
  position: relative;
  padding-left: 80px;
  padding-top: 22px;
  --hover-more: hidden;
}
.body:hover {
  --hover-more: visible;
}
.body.spotlight {
  background: var(--brand_blue_thin);
}
.body.gone .content,
.body.gone .pictures {
  opacity: 0.7;
}
.user-avatar {
  position: absolute;
  left: 20px;
  top: 22px;
}
.header {
  margin-bottom: 4px;
}
.user-info {
  display: inline-flex;
  align-items: center;
  height: 30px;
}
.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
}
.user-info :deep(.level) {
  margin-left: 5px;
}
.ornament {
  position: absolute;
  right: 0;
  top: 7px;
  max-width: 288px;
  height: 48px;
}
.content {
  font-size: 15px;
  line-height: 24px;
  color: var(--text1);
  overflow: hidden;
}
.pictures {
  margin-top: 8px;
}
.tags {
  margin-top: 6px;
  display: flex;
  align-items: center;
}
.tag {
  color: var(--c, var(--text3));
  background-color: var(--b, var(--bg3));
  padding: 6px;
  border-radius: 2px;
  font-size: 12px;
  line-height: 1;
}
:root[data-theme='dark'] .tag {
  color: var(--cd, var(--text3));
  background-color: var(--bd, var(--bg3));
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .tag {
    color: var(--cd, var(--text3));
    background-color: var(--bd, var(--bg3));
  }
}
.tag + .tag {
  margin-left: 10px;
}
.replies {
  padding-left: 80px;
  margin-top: 2px;
}
.replies-footer {
  font-size: 13px;
  color: var(--text3);
}
.view-more {
  color: var(--text3);
}
.text-btn {
  height: 28px;
  padding: 0 4px;
  font-size: 13px;
  color: var(--text3);
}
.view-more + .text-btn {
  padding-left: 0;
}
.text-btn:hover {
  color: var(--brand_blue);
}
.pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  color: var(--text1);
}
.pagination .text-btn {
  color: var(--text1);
  margin-left: 4px;
}
.pagination .text-btn.active {
  color: var(--brand_blue);
}
.pagination .text-btn:hover {
  color: var(--brand_blue);
}
.pagination-head {
  margin-right: 6px;
}
.ellipsis-dot {
  margin-left: 4px;
}
.divider {
  padding-bottom: 14px;
  margin-left: 80px;
  border-bottom: 1px solid var(--graph_bg_thick);
}
</style>
