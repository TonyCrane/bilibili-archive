<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Avatar from '../components/Avatar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import MComments from '../components/comments/MComments.vue'
import ArchiveInfo from '../components/video/ArchiveInfo.vue'
import DescText from '../components/video/DescText.vue'
import DanmakuPanel from '../components/video/DanmakuPanel.vue'
import type { FocusTarget, VideoPayload } from '../types'
import type { CommentList } from '../composables/comments'
import { toast } from '../composables/app'
import { count, date, duration, spaceUrl } from '../utils/format'

const props = defineProps<{ payload: VideoPayload; list: CommentList; focus: FocusTarget | null }>()
const router = useRouter()
const v = computed(() => props.payload.video)
const origin = computed(() => `https://www.bilibili.com/video/${v.value.bvid}/`)
const reup = computed(() => v.value.reupload[0] || null)
const playHref = computed(() =>
  v.value.status.ok ? origin.value : reup.value ? `https://www.bilibili.com/video/${reup.value.bvid}/` : undefined)
const num = (n: number) => (v.value.statKnown ? count(n) : '—')
const total = computed(() => v.value.comments?.siteCount || v.value.stat.reply)

const tab = ref<'intro' | 'reply'>(location.hash.startsWith('#reply') ? 'reply' : 'intro')
const descOpen = ref(false)

const playerEl = ref<HTMLElement | null>(null)

// 切换标签时，若标签栏已吸顶则回到标签栏位置
function switchTab(t: 'intro' | 'reply') {
  if (tab.value === t) return
  tab.value = t
  const h = playerEl.value?.offsetHeight || 0
  if (window.scrollY > h) window.scrollTo({ top: h })
}
function back() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}

const comments = ref<InstanceType<typeof MComments> | null>(null)
watch(
  () => props.focus,
  async f => {
    if (!f) return
    tab.value = 'reply'
    await nextTick()
    if (f.subId) {
      const root = props.payload.comments?.roots.find(r => r.id === f.rootId)
      if (root) comments.value?.open(root, f.subId)
    }
  },
  { immediate: true },
)

const tools = computed(() => [
  { icon: 'thumb', value: v.value.stat.like, label: '点赞' },
  { icon: 'dislike', value: 0, label: '不喜欢' },
  { icon: 'coin', value: v.value.stat.coin, label: '投币' },
  { icon: 'fav', value: v.value.stat.favorite, label: '收藏' },
  { icon: 'share', value: v.value.stat.share, label: '分享' },
])
</script>

<template>
  <div class="m-video">
    <!-- 顶部封面（代替播放器） -->
    <div ref="playerEl" class="m-player" :class="{ dead: !v.status.ok }">
      <div class="bg" :style="{ backgroundImage: `url(${v.cover})` }" />
      <img class="cover" :src="v.cover" alt="视频封面" />
      <div class="top-bar">
        <button class="icon-btn" aria-label="返回" @click="back"><Icon name="back" :size="22" /></button>
        <span class="spacer" />
        <ThemeToggle light />
        <a v-if="playHref" class="icon-btn" :href="playHref" target="_blank" rel="noreferrer" aria-label="在B站打开"><Icon name="link" :size="18" /></a>
      </div>
      <a v-if="playHref" class="play" :class="{ reup: !v.status.ok }" :href="playHref" target="_blank" rel="noreferrer" :aria-label="v.status.ok ? '在B站播放' : '前往补档视频'">
        <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.97-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" fill="currentColor" /></svg>
      </a>
      <span v-if="playHref && !v.status.ok" class="play-label">前往补档视频</span>
      <span v-if="!playHref" class="no-reup">暂未补档</span>
      <span class="dur">{{ duration(v.duration) }}</span>
      <div v-if="!v.status.ok" class="dead" :title="v.status.reason">原视频{{ v.status.message || '已失效' }} · {{ playHref ? '已补档' : '暂未补档' }}</div>
    </div>

    <!-- 简介 / 评论 标签栏 -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'intro' }" @click="switchTab('intro')">简介</button>
      <button class="tab" :class="{ active: tab === 'reply' }" @click="switchTab('reply')">评论<span class="num">{{ total }}</span></button>
      <button class="dm-input" @click="toast('这是存档页面，无法发送弹幕')">
        <span>点我发弹幕</span>
        <span class="dm-icon">
          <svg viewBox="0 0 28 28" width="24" height="24"><rect x="3.5" y="6.5" width="21" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M10 3.5l2.5 3M18 3.5l-2.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><text x="14" y="19.5" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">弹</text><path d="M18.5 21.5l2.2 2.2 4.3-4.6" fill="none" stroke="#ff6699" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
      </button>
    </div>

    <!-- 简介 -->
    <div v-show="tab === 'intro'" class="intro">
      <div v-if="v.staff.length" class="staff">
        <a v-for="s in v.staff" :key="s.mid" class="staff-item" :href="spaceUrl(s.mid)" target="_blank" rel="noreferrer">
          <Avatar :face="s.face" :size="40" :vip="s.vip.subscript" :official="s.official" />
          <span class="staff-name" :style="{ color: s.vip.nameColor || undefined }">{{ s.name }}</span>
          <span class="staff-role">{{ s.title }}</span>
        </a>
      </div>
      <div v-else class="up">
        <Avatar :face="v.owner.face" :mid="v.owner.mid" :size="34" :vip="v.upCard?.vip.subscript" :official="v.upCard?.official ?? -1" />
        <div class="up-info">
          <a class="up-name" :href="spaceUrl(v.owner.mid)" target="_blank" rel="noreferrer" :style="{ color: v.upCard?.vip.nameColor || undefined }">{{ v.owner.name }}</a>
          <div v-if="v.upCard" class="up-fans">{{ count(v.upCard.fans) }}粉丝 · {{ v.upCard.archiveCount }}视频</div>
        </div>
        <a class="follow" :href="spaceUrl(v.owner.mid)" target="_blank" rel="noreferrer">+ 关注</a>
      </div>

      <div class="title-row" @click="descOpen = !descOpen">
        <h1 class="title" :class="{ open: descOpen }">{{ v.title }}</h1>
        <Icon name="down" :size="16" class="arrow" :class="{ open: descOpen }" />
      </div>
      <div class="meta">
        <span><Icon name="play" :size="15" />{{ num(v.stat.view) }}</span>
        <span><Icon name="danmaku" :size="15" />{{ num(v.stat.danmaku) }}</span>
        <span>{{ date(v.pubdate) }}</span>
        <span v-if="v.noReprint"><Icon name="ban" :size="12" />未经作者授权禁止转载</span>
      </div>
      <div v-if="descOpen" class="desc-box">
        <div class="bvid">{{ v.bvid }} · av{{ v.aid }}</div>
        <div class="desc"><DescText :video="v" /></div>
      </div>
      <div v-if="v.argue" class="argue"><Icon name="warn" :size="14" />{{ v.argue }}</div>

      <div class="tools">
        <div v-for="t in tools" :key="t.label" class="tool">
          <Icon :name="t.icon" :size="t.icon === 'dislike' ? 26 : 28" />
          <span>{{ t.value ? num(t.value) : t.label }}</span>
        </div>
      </div>

      <div v-if="v.tagList.length" class="tags">
        <a
          v-for="t in v.tagList"
          :key="t.name"
          class="tag"
          :href="t.jumpUrl || `https://search.bilibili.com/all?keyword=${encodeURIComponent(t.name)}`"
          target="_blank"
          rel="noreferrer"
        >{{ t.name }}</a>
      </div>

      <div v-if="v.pages.length > 1" class="pages">
        <div class="pages-title">选集（{{ v.pages.length }}）</div>
        <div class="page-scroll">
          <a v-for="p in v.pages" :key="p.cid" class="page" :href="`${origin}?p=${p.page}`" target="_blank" rel="noreferrer">
            <span class="ellipsis">P{{ p.page }} {{ p.part }}</span>
          </a>
        </div>
      </div>

      <div v-if="v.reupload.length || v.reuploadOf.length" class="reup-links">
        <template v-for="r in v.reupload" :key="r.bvid">
          <a class="reup-btn pink" :href="`https://www.bilibili.com/video/${r.bvid}/`" target="_blank" rel="noreferrer">前往补档视频</a>
          <RouterLink v-if="r.archived" class="reup-btn" :to="`/video/${r.bvid}`">补档视频存档</RouterLink>
        </template>
        <template v-for="o in v.reuploadOf" :key="o.bvid">
          <RouterLink v-if="o.archived" class="reup-btn" :to="`/video/${o.bvid}`">原视频存档</RouterLink>
        </template>
      </div>

      <div class="archive"><ArchiveInfo :video="v" :comments="payload.comments" mobile /></div>
      <div v-if="v.danmaku !== null" class="archive"><DanmakuPanel :bvid="v.bvid" :count="v.danmaku" mobile /></div>
      <button class="goto-reply" @click="switchTab('reply')">查看 {{ v.comments?.total ?? 0 }} 条存档评论</button>
    </div>

    <!-- 评论 -->
    <div v-show="tab === 'reply'">
      <MComments v-if="payload.comments" ref="comments" :list="list" />
      <div v-else class="empty">该视频还没有评论区存档</div>
    </div>
  </div>
</template>

<style scoped>
.m-video {
  min-height: 100vh;
  background: var(--bg1);
}
.m-player {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}
.bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(20px) brightness(0.5);
}
.cover {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.top-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  padding: env(safe-area-inset-top) 6px 0;
  height: calc(44px + env(safe-area-inset-top));
  background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
  color: #fff;
}
.spacer {
  flex: 1;
}
.icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 54px;
  height: 54px;
  margin: -27px 0 0 -27px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 3px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
}
.play.reup {
  background: var(--brand_pink);
}
.play-label {
  position: absolute;
  left: 50%;
  top: calc(50% + 34px);
  transform: translateX(-50%);
  font-size: 13px;
  color: #fff;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}
.no-reup {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 6px 18px;
  border-radius: 16px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.55);
}
.reup-links {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.reup-btn {
  flex: 1;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 36px;
  text-align: center;
  color: var(--text1);
  background: var(--graph_bg_regular);
}
.reup-btn.pink {
  color: #fff;
  background: var(--brand_pink);
}
.m-player.dead .dur {
  bottom: 30px;
}
.dur {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
}
.dead {
  position: absolute;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 10px;
  font-size: 12px;
  color: #fff;
  background: rgba(255, 127, 36, 0.85);
}
.tabs {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 0 0 4px;
  background: var(--bg1);
  border-bottom: 0.5px solid var(--line_regular);
}
.tab {
  position: relative;
  height: 100%;
  padding: 0 14px;
  font-size: 15px;
  color: var(--text2);
}
.tab .num {
  margin-left: 4px;
  font-size: 12px;
}
.tab.active {
  color: var(--brand_pink);
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 44px;
  height: 2px;
  margin-left: -22px;
  border-radius: 1px;
  background: var(--brand_pink);
}
.dm-input {
  margin-left: auto;
  margin-right: 10px;
  display: flex;
  align-items: center;
  height: 28px;
  padding-left: 14px;
  border-radius: 14px;
  border: 0.5px solid var(--line_regular);
  background: var(--graph_bg_thin);
  font-size: 13px;
  color: var(--text3);
}
.dm-icon {
  display: flex;
  align-items: center;
  height: 100%;
  margin-left: 10px;
  padding: 0 8px;
  border-left: 0.5px solid var(--line_regular);
  color: var(--text2);
}
.intro {
  padding: 12px 12px calc(24px + env(safe-area-inset-bottom));
}
.up {
  display: flex;
  align-items: center;
  gap: 10px;
}
.up-info {
  flex: 1;
  min-width: 0;
}
.up-name {
  display: block;
  font-size: 14px;
  color: var(--text1);
}
.up-fans {
  font-size: 11px;
  color: var(--text3);
}
.follow {
  height: 28px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 28px;
  color: #fff;
  background: var(--brand_pink);
}
.staff {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.staff-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 56px;
  font-size: 11px;
}
.staff-name {
  max-width: 100%;
  margin-top: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text1);
}
.staff-role {
  color: var(--text3);
}
.title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
}
.title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  color: var(--text1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.title.open {
  -webkit-line-clamp: unset;
}
.arrow {
  margin-top: 3px;
  color: var(--text3);
  transition: transform 0.2s;
}
.arrow.open {
  transform: rotate(180deg);
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text3);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.desc-box {
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--text2);
}
.bvid {
  color: var(--text3);
  font-size: 12px;
}
.desc {
  margin-top: 6px;
}
.argue {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--warn);
}
.tools {
  display: flex;
  justify-content: space-around;
  margin: 18px -4px 6px;
}
.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 52px;
  font-size: 12px;
  color: var(--text2);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.tag {
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  font-size: 12px;
  line-height: 26px;
  color: var(--text2);
  background: var(--graph_bg_regular);
}
.pages {
  margin-top: 16px;
}
.pages-title {
  font-size: 14px;
  color: var(--text1);
  margin-bottom: 8px;
}
.page-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}
.page {
  flex-shrink: 0;
  width: 120px;
  height: 52px;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text1);
  background: var(--graph_bg_regular);
}
.archive {
  margin-top: 16px;
}
.goto-reply {
  display: block;
  width: 100%;
  margin-top: 16px;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--brand_pink);
  background: var(--brand_pink_thin);
}
.empty {
  padding: 60px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text3);
}
</style>
