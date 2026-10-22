<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import Icon from '../components/Icon.vue'
import Avatar from '../components/Avatar.vue'
import PcComments from '../components/comments/PcComments.vue'
import ArchiveInfo from '../components/video/ArchiveInfo.vue'
import DescText from '../components/video/DescText.vue'
import DanmakuPanel from '../components/video/DanmakuPanel.vue'
import type { FocusTarget, VideoPayload } from '../types'
import type { CommentList } from '../composables/comments'
import { count, dateTime, duration, spaceUrl } from '../utils/format'

const props = defineProps<{ payload: VideoPayload; list: CommentList; focus: FocusTarget | null }>()
const v = computed(() => props.payload.video)
const origin = computed(() => `https://www.bilibili.com/video/${v.value.bvid}/`)
const reup = computed(() => v.value.reupload[0] || null)
// 原视频可播放时前往原视频；失效时前往补档视频（archive/reupload.json）
const playHref = computed(() =>
  v.value.status.ok ? origin.value : reup.value ? `https://www.bilibili.com/video/${reup.value.bvid}/` : undefined)
const num = (n: number) => (v.value.statKnown ? count(n) : '—')
const openSub = computed(() => props.focus?.subId || '')
const total = computed(() => v.value.comments?.siteCount || v.value.stat.reply)

// 简介超过 4 行时折叠
const descEl = ref<HTMLElement | null>(null)
const descOverflow = ref(false)
const descOpen = ref(false)
onMounted(async () => {
  await nextTick()
  const el = descEl.value
  if (el) descOverflow.value = el.scrollHeight > el.clientHeight + 2
})

const toolbar = computed(() => [
  { icon: 'thumb', label: '点赞', value: v.value.stat.like, size: 28 },
  { icon: 'coin', label: '投币', value: v.value.stat.coin, size: 28 },
  { icon: 'fav', label: '收藏', value: v.value.stat.favorite, size: 28 },
  { icon: 'share', label: '转发', value: v.value.stat.share, size: 28 },
])
</script>

<template>
  <AppHeader />
  <div class="video-container">
    <div class="left-container">
      <div class="video-info">
        <h1 class="video-title" :title="v.title">{{ v.title }}</h1>
        <div class="video-meta">
          <span class="item" title="播放量"><Icon name="play" :size="20" />{{ num(v.stat.view) }}</span>
          <span class="item" title="弹幕数"><Icon name="danmaku" :size="20" />{{ num(v.stat.danmaku) }}</span>
          <span class="item pubdate">{{ dateTime(v.pubdate, true) }}</span>
          <span v-if="v.noReprint" class="item"><Icon name="ban" :size="16" />未经作者授权，禁止转载</span>
          <span v-if="v.honor.length" class="item honor">{{ v.honor.join(' · ') }}</span>
        </div>
        <div v-if="v.argue" class="argue"><Icon name="warn" :size="16" />{{ v.argue }}</div>
      </div>

      <component
        :is="playHref ? 'a' : 'div'"
        class="player"
        :class="{ dead: !v.status.ok, reup: !v.status.ok && reup }"
        :href="playHref"
        target="_blank"
        rel="noreferrer"
      >
        <div class="player-bg" :style="{ backgroundImage: `url(${v.cover})` }" />
        <img class="player-cover" :src="v.cover" alt="视频封面" />
        <div class="player-mask">
          <template v-if="playHref">
            <span class="play-btn"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.97-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" fill="currentColor" /></svg></span>
            <span class="play-tip">{{ v.status.ok ? '前往 B 站播放原视频' : '前往补档视频' }}</span>
          </template>
          <span v-else class="no-reup">暂未补档</span>
        </div>
        <span class="corner left">存档封面</span>
        <span class="corner right">{{ duration(v.duration) }}</span>
        <div v-if="!v.status.ok" class="dead-banner">
          <Icon name="warn" :size="16" />
          <span>原视频{{ v.status.message || '已失效' }}<template v-if="v.status.reason">：{{ v.status.reason }}</template></span>
        </div>
      </component>

      <div class="toolbar">
        <div class="toolbar-left">
          <span v-for="t in toolbar" :key="t.label" class="tool" :title="`${t.label}：${t.value}`">
            <Icon :name="t.icon" :size="t.size" /><span>{{ num(t.value) }}</span>
          </span>
        </div>
        <div class="toolbar-right">
          <template v-for="r in v.reupload" :key="r.bvid">
            <a class="origin-btn pink" :href="`https://www.bilibili.com/video/${r.bvid}/`" target="_blank" rel="noreferrer"><Icon name="link" :size="16" />补档视频</a>
            <RouterLink v-if="r.archived" class="origin-btn" :to="`/video/${r.bvid}`"><Icon name="archive" :size="16" />补档视频存档</RouterLink>
          </template>
          <template v-for="o in v.reuploadOf" :key="o.bvid">
            <RouterLink v-if="o.archived" class="origin-btn" :to="`/video/${o.bvid}`"><Icon name="archive" :size="16" />原视频存档</RouterLink>
          </template>
          <a v-if="v.status.ok" class="origin-btn" :href="origin" target="_blank" rel="noreferrer"><Icon name="link" :size="16" />原视频</a>
          <a class="origin-btn" :href="v.cover" target="_blank" rel="noreferrer"><Icon name="image" :size="16" />封面原图</a>
        </div>
      </div>

      <div class="desc">
        <div ref="descEl" class="desc-info" :class="{ open: descOpen }"><DescText :video="v" /></div>
        <button v-if="descOverflow" class="toggle-btn" @click="descOpen = !descOpen">{{ descOpen ? '收起' : '展开更多' }}</button>
      </div>

      <div v-if="v.tagList.length" class="tags">
        <a
          v-for="t in v.tagList"
          :key="t.name"
          class="tag"
          :class="{ topic: t.type === 'topic' }"
          :href="t.jumpUrl || `https://search.bilibili.com/all?keyword=${encodeURIComponent(t.name)}`"
          target="_blank"
          rel="noreferrer"
        ><Icon v-if="t.type === 'topic'" name="topic" :size="14" />{{ t.name }}</a>
      </div>

      <div class="comment-wrap">
        <PcComments v-if="payload.comments" :list="list" :total="total" :open-sub="openSub" />
        <div v-else class="no-comments">该视频还没有评论区存档</div>
      </div>
    </div>

    <aside class="right-container">
      <div v-if="v.staff.length" class="staff">
        <div class="staff-title">创作团队<span>{{ v.staff.length }}人</span></div>
        <div class="staff-list">
          <a v-for="s in v.staff" :key="s.mid" class="staff-item" :href="spaceUrl(s.mid)" target="_blank" rel="noreferrer">
            <Avatar :face="s.face" :size="40" :vip="s.vip.subscript" :official="s.official" />
            <span class="staff-name ellipsis" :style="{ color: s.vip.nameColor || undefined }">{{ s.name }}</span>
            <span class="staff-role ellipsis">{{ s.title }}</span>
          </a>
        </div>
      </div>
      <div v-else class="up-panel">
        <Avatar :face="v.owner.face" :mid="v.owner.mid" :size="48" :vip="v.upCard?.vip.subscript" :official="v.upCard?.official ?? -1" />
        <div class="up-info">
          <a class="up-name ellipsis" :href="spaceUrl(v.owner.mid)" target="_blank" rel="noreferrer" :style="{ color: v.upCard?.vip.nameColor || undefined }">{{ v.owner.name }}</a>
          <div class="up-desc ellipsis" :title="v.upCard?.sign">{{ v.upCard?.officialTitle || v.upCard?.sign || '' }}</div>
          <a class="follow-btn" :href="spaceUrl(v.owner.mid)" target="_blank" rel="noreferrer">
            + 关注 <span v-if="v.upCard">{{ count(v.upCard.fans) }}</span>
          </a>
        </div>
      </div>

      <div v-if="v.pages.length > 1" class="pages">
        <div class="pages-title">视频选集 <span>（{{ v.pages.length }}P）</span></div>
        <a
          v-for="p in v.pages"
          :key="p.cid"
          class="page-item"
          :href="`${origin}?p=${p.page}`"
          target="_blank"
          rel="noreferrer"
        >
          <span class="p">P{{ p.page }}</span><span class="part ellipsis">{{ p.part }}</span><span class="dur">{{ duration(p.duration) }}</span>
        </a>
      </div>

      <ArchiveInfo :video="v" :comments="payload.comments" />

      <DanmakuPanel v-if="v.danmaku !== null" :bvid="v.bvid" :count="v.danmaku" />

      <div v-if="v.dynamic" class="dynamic">
        <div class="dynamic-title">投稿动态</div>
        <div class="dynamic-text">{{ v.dynamic }}</div>
      </div>

    </aside>
  </div>
</template>

<style scoped>
.video-container {
  display: flex;
  justify-content: center;
  gap: 30px;
  max-width: 1460px;
  margin: 0 auto;
  padding: 0 30px;
}
.left-container {
  flex: 1;
  min-width: 0;
  max-width: 1060px;
}
.right-container {
  flex: none;
  width: 350px;
  padding: 22px 4px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  /* 固定在右侧，内容过长时独立滚动 */
  position: sticky;
  top: 64px;
  align-self: flex-start;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.right-container:hover {
  scrollbar-color: var(--graph_bg_thick) transparent;
}
.right-container > * {
  flex-shrink: 0;
}
.video-info {
  padding-top: 22px;
  padding-bottom: 12px;
}
.video-title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  color: var(--text1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.video-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text3);
  height: 24px;
  overflow: hidden;
}
.video-meta .item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.honor {
  color: var(--warn);
}
.argue {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--warn);
}
.player {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
  border-radius: 4px;
}
.player-bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(24px) brightness(0.55);
}
.player-cover {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.player-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.12);
  opacity: 0.9;
  transition: 0.2s;
}
.player:hover .player-mask {
  opacity: 1;
  background: rgba(0, 0, 0, 0.3);
}
.play-btn {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  transition: 0.2s;
}
.player:hover .play-btn {
  background: var(--brand_pink);
}
.player.dead .player-cover {
  filter: grayscale(0.6) brightness(0.75);
}
.player.reup .play-btn {
  background: var(--brand_pink);
}
.no-reup {
  padding: 8px 22px;
  border-radius: 20px;
  font-size: 16px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}
div.player .player-mask {
  background: rgba(0, 0, 0, 0.2);
}
.play-tip {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
}
.corner {
  position: absolute;
  top: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
}
.corner.left {
  left: 12px;
}
.corner.right {
  right: 12px;
}
.dead-banner {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  line-height: 18px;
  font-size: 13px;
  color: #fff;
  background: rgba(255, 127, 36, 0.85);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--line_regular);
}
.toolbar-left {
  display: flex;
  align-items: center;
}
.tool {
  display: inline-flex;
  align-items: center;
  width: 92px;
  margin-right: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text2);
}
.tool span {
  margin-left: 8px;
}
.toolbar-right {
  display: flex;
  gap: 8px;
}
.origin-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text2);
  background: var(--graph_bg_regular);
}
.origin-btn:hover {
  color: var(--brand_blue);
}
.origin-btn.pink {
  color: #fff;
  background: var(--brand_pink);
}
.origin-btn.pink:hover {
  color: #fff;
  opacity: 0.9;
}
.desc {
  margin: 16px 0;
}
.desc-info {
  font-size: 15px;
  line-height: 24px;
  color: var(--text1);
  max-height: 96px;
  overflow: hidden;
}
.desc-info.open {
  max-height: none;
}
.toggle-btn {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text2);
}
.toggle-btn:hover {
  color: var(--brand_blue);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line_regular);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  font-size: 13px;
  color: var(--text2);
  background: var(--graph_bg_regular);
  transition: 0.2s;
}
.tag:hover {
  color: var(--brand_blue);
}
.tag.topic {
  color: var(--brand_blue);
}
.comment-wrap {
  margin-top: 24px;
}
.no-comments {
  padding: 40px 0;
  text-align: center;
  color: var(--text3);
}
.up-panel {
  display: flex;
  gap: 12px;
}
.up-info {
  flex: 1;
  min-width: 0;
}
.up-name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: var(--text1);
  line-height: 22px;
}
.up-desc {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text3);
  line-height: 16px;
}
.follow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  width: 200px;
  height: 30px;
  border-radius: 6px;
  font-size: 14px;
  color: #fff;
  background: var(--brand_blue);
}
.follow-btn:hover {
  background: #40c5f1;
}
.staff-title,
.pages-title,
.dynamic-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text1);
  margin-bottom: 12px;
}
.staff-title span,
.pages-title span {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text3);
}
.staff-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 8px;
}
.staff-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  font-size: 12px;
}
.staff-name {
  max-width: 100%;
  margin-top: 6px;
  color: var(--text1);
}
.staff-role {
  max-width: 100%;
  color: var(--text3);
}
.pages {
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--bg2);
}
.page-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text1);
}
.page-item:hover {
  background: var(--graph_bg_thick);
}
.page-item .p {
  color: var(--text3);
}
.page-item .part {
  flex: 1;
}
.page-item .dur {
  color: var(--text3);
}
.dynamic {
  padding: 14px 16px;
  border-radius: 6px;
  background: var(--bg2);
}
.dynamic-title {
  margin-bottom: 6px;
}
.dynamic-text {
  font-size: 13px;
  color: var(--text2);
  white-space: pre-line;
}
@media (max-width: 1100px) {
  .video-container {
    padding: 0 20px;
    gap: 20px;
  }
  .right-container {
    width: 300px;
  }
  .follow-btn {
    width: 100%;
  }
  .tool {
    width: auto;
    margin-right: 22px;
  }
}
</style>
