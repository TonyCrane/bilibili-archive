<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import Icon from '../components/Icon.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import VideoCard from '../components/VideoCard.vue'
import logo from '../assets/bili-logo.svg?raw'
import type { VideoSummary } from '../types'
import { loadIndex, viewport } from '../composables/app'
import { matchVideo, parseVideoId } from '../utils/search'
import { count } from '../utils/format'
import { setTitle } from '../router'
import { REPO_URL, SITE_DESCRIPTION, SITE_TITLE } from '../config'

setTitle()
const route = useRoute()
const router = useRouter()
const videos = ref<VideoSummary[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')
const error = ref('')
loadIndex()
  .then(v => {
    videos.value = v
    state.value = 'ok'
  })
  .catch(e => {
    error.value = String(e)
    state.value = 'error'
  })

const q = computed(() => String(route.query.q || ''))
const mq = ref(q.value)
watch(q, v => (mq.value = v))

type SortKey = 'archived' | 'pubdate' | 'view' | 'reply'
const sort = ref<SortKey>('pubdate')
const sorts: { key: SortKey; label: string }[] = [
  { key: 'pubdate', label: '最新发布' },
  { key: 'archived', label: '最近存档' },
  { key: 'view', label: '最多播放' },
  { key: 'reply', label: '最多评论' },
]

const list = computed(() => {
  const out = videos.value.filter(v => matchVideo(v, q.value))
  const by: Record<SortKey, (a: VideoSummary, b: VideoSummary) => number> = {
    archived: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    pubdate: (a, b) => b.pubdate - a.pubdate,
    view: (a, b) => b.stat.view - a.stat.view,
    reply: (a, b) => (b.comments?.total ?? 0) - (a.comments?.total ?? 0),
  }
  return out.sort(by[sort.value])
})

const totals = computed(() => ({
  videos: videos.value.length,
  comments: videos.value.reduce((n, v) => n + (v.comments?.total ?? 0), 0),
  dead: videos.value.filter(v => !v.status.ok).length,
  updated: videos.value.map(v => v.updatedAt).sort().pop() || '',
}))

function submitMobile() {
  const text = mq.value.trim()
  const id = parseVideoId(text)
  if (id) return router.push(`/video/${id}`)
  router.replace({ query: text ? { q: text } : {} })
}
</script>

<template>
  <AppHeader v-if="!viewport.mobile" />
  <header v-else class="m-header">
    <RouterLink to="/" class="m-logo" v-html="logo" />
    <form class="m-search" role="search" @submit.prevent="submitMobile">
      <Icon name="search" :size="15" />
      <input v-model="mq" type="search" enterkeyhint="search" placeholder="搜索存档 / BV号" />
    </form>
    <ThemeToggle />
    <a v-if="REPO_URL" class="m-repo" :href="REPO_URL" target="_blank" rel="noreferrer" title="GitHub" aria-label="GitHub 仓库"><Icon name="github" :size="20" /></a>
  </header>

  <main class="home">
    <section class="hero">
      <div class="hero-text">
        <h1>{{ SITE_TITLE }}</h1>
        <p v-if="SITE_DESCRIPTION">{{ SITE_DESCRIPTION }}</p>
      </div>
      <div class="hero-stats">
        <div><b>{{ totals.videos }}</b><span>视频存档</span></div>
        <div><b>{{ count(totals.comments) }}</b><span>条评论</span></div>
        <div><b>{{ totals.dead }}</b><span>已失效</span></div>
      </div>
    </section>

    <div class="toolbar">
      <div class="sorts">
        <button v-for="s in sorts" :key="s.key" :class="{ active: sort === s.key }" @click="sort = s.key">{{ s.label }}</button>
      </div>
      <div class="result">
        <template v-if="q">「{{ q }}」共 {{ list.length }} 个结果 <RouterLink to="/" class="clear">清除</RouterLink></template>
        <template v-else-if="totals.updated">最近更新：{{ totals.updated.slice(0, 16) }}</template>
      </div>
    </div>

    <div v-if="state === 'loading'" class="empty">正在读取存档…</div>
    <div v-else-if="state === 'error'" class="empty">读取存档失败：{{ error }}</div>
    <div v-else-if="!videos.length" class="empty">
      <p>还没有任何存档。</p>
      <p>使用 <code>python collector/bili_archive.py collect BV号 --cookie-file cookie.txt</code> 抓取后刷新页面即可。</p>
    </div>
    <div v-else-if="!list.length" class="empty">没有找到相关的视频存档</div>
    <div v-else class="grid">
      <VideoCard v-for="v in list" :key="v.bvid" :video="v" />
    </div>
  </main>
</template>

<style scoped>
.home {
  max-width: 1460px;
  margin: 0 auto;
  padding: 24px 30px 60px;
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 30px;
  border-radius: 10px;
  background:
    radial-gradient(circle at 85% 20%, rgba(0, 174, 236, 0.18), transparent 45%),
    radial-gradient(circle at 10% 90%, rgba(255, 102, 153, 0.16), transparent 40%),
    var(--bg2);
}
.hero h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text1);
}
.hero p {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text2);
}
.hero-stats {
  display: flex;
  gap: 32px;
  flex-shrink: 0;
}
.hero-stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-stats b {
  font-size: 24px;
  font-weight: 600;
  color: var(--brand_blue);
  font-variant-numeric: tabular-nums;
}
.hero-stats div:nth-child(2) b {
  color: var(--brand_pink);
}
.hero-stats div:nth-child(3) b {
  color: var(--text2);
}
.hero-stats span {
  font-size: 12px;
  color: var(--text3);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 20px 0 16px;
}
.sorts {
  display: flex;
  gap: 8px;
}
.sorts button {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text2);
  background: var(--graph_bg_regular);
}
.sorts button:hover {
  color: var(--brand_blue);
}
.sorts button.active {
  color: var(--brand_blue);
  background: var(--brand_blue_thin);
}
.result {
  font-size: 13px;
  color: var(--text3);
}
.clear {
  margin-left: 6px;
  color: var(--text_link);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px 20px;
}
.empty {
  padding: 80px 0;
  text-align: center;
  font-size: 14px;
  color: var(--text3);
}
.empty code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg3);
  color: var(--text2);
  word-break: break-all;
}

/* ---------- 移动端（仿 m.bilibili.com） ---------- */
.m-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  height: calc(48px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 8px 0 12px;
  background: var(--bg1);
  border-bottom: 0.5px solid var(--line_regular);
}
.m-logo {
  display: flex;
  color: var(--brand_pink);
}
.m-logo :deep(svg) {
  height: 26px;
  width: auto;
}
.m-repo {
  width: 34px;
  height: 34px;
  margin-left: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
}
.m-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 16px;
  color: var(--text3);
  background: var(--graph_bg_regular);
}
.m-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text1);
}
.m-search input::-webkit-search-cancel-button {
  display: none;
}
@media (max-width: 767px) {
  .home {
    padding: 12px 10px 40px;
  }
  .hero {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
    gap: 14px;
    border-radius: 8px;
  }
  .hero h1 {
    font-size: 18px;
  }
  .hero p {
    font-size: 12px;
  }
  .hero-stats {
    justify-content: space-around;
  }
  .hero-stats b {
    font-size: 20px;
  }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    margin: 12px 0 10px;
  }
  .sorts {
    gap: 6px;
    overflow-x: auto;
  }
  .sorts button {
    flex-shrink: 0;
    height: 28px;
    padding: 0 10px;
    font-size: 13px;
  }
  .result {
    font-size: 12px;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 8px;
  }
}
</style>
