<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import PcVideo from './PcVideo.vue'
import MVideo from './MVideo.vue'
import type { FocusTarget, VideoPayload } from '../types'
import { loadVideo, toast, viewport } from '../composables/app'
import { provideCommentContext, useCommentList } from '../composables/comments'
import { setTitle } from '../router'

const route = useRoute()
const bvid = computed(() => String(route.params.id))
const payload = ref<VideoPayload | null>(null)
const state = ref<'loading' | 'ok' | 'missing' | 'error'>('loading')
const error = ref('')

const comments = computed(() => payload.value?.comments ?? null)
const list = useCommentList(comments)
const spotlight = ref('')
const upperMid = computed(() => comments.value?.upperMid || payload.value?.video.owner.mid || '')
provideCommentContext({ bvid: bvid.value, upperMid, keyword: list.keyword, spotlight })

const focus = ref<FocusTarget | null>(null)
let n = 0

async function load() {
  state.value = 'loading'
  try {
    payload.value = await loadVideo(bvid.value)
    state.value = payload.value ? 'ok' : 'missing'
    setTitle(payload.value ? payload.value.video.title : '未找到存档')
  } catch (e) {
    error.value = String(e)
    state.value = 'error'
  }
  await nextTick()
  focusHash()
}

/** 处理 #reply<rpid> 形式的评论定位链接 */
async function focusHash() {
  const m = route.hash.match(/^#reply(\d+)$/)
  if (!m || state.value !== 'ok') return
  const loc = list.locate(m[1])
  if (!loc) return toast('存档中没有找到这条评论')
  list.reveal(loc.root.id)
  spotlight.value = m[1]
  focus.value = { id: m[1], rootId: loc.root.id, subId: loc.sub?.id || '', n: ++n }
  await nextTick()
  await nextTick()
  document.getElementById(`reply${m[1]}`)?.scrollIntoView({ block: 'center' })
  setTimeout(() => {
    if (spotlight.value === m[1]) spotlight.value = ''
  }, 4000)
}

watch(() => route.hash, focusHash)
load()
</script>

<template>
  <div class="video-page">
    <template v-if="state === 'ok' && payload">
      <MVideo v-if="viewport.mobile" :payload="payload" :list="list" :focus="focus" />
      <PcVideo v-else :payload="payload" :list="list" :focus="focus" />
    </template>
    <template v-else>
      <AppHeader v-if="!viewport.mobile" />
      <div class="placeholder">
        <template v-if="state === 'loading'">
          <div class="spinner" />
          <p>正在读取存档…</p>
        </template>
        <template v-else-if="state === 'missing'">
          <p class="big">没有找到 {{ bvid }} 的存档</p>
          <p>
            可以使用 <code>python collector/bili_archive.py collect {{ bvid }}</code> 抓取，
            或 <a :href="`https://www.bilibili.com/video/${bvid}/`" target="_blank" rel="noreferrer">前往 B 站查看</a>
          </p>
          <RouterLink to="/" class="home">返回首页</RouterLink>
        </template>
        <template v-else>
          <p class="big">读取存档失败</p>
          <p>{{ error }}</p>
          <button class="home" @click="load">重试</button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-page {
  min-height: 100vh;
}
.placeholder {
  padding: 120px 20px;
  text-align: center;
  color: var(--text2);
  font-size: 14px;
}
.placeholder .big {
  font-size: 18px;
  color: var(--text1);
}
.placeholder code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg3);
  font-size: 13px;
  word-break: break-all;
}
.placeholder a {
  color: var(--text_link);
}
.home {
  display: inline-block;
  margin-top: 16px;
  padding: 0 20px;
  line-height: 34px;
  border-radius: 6px;
  color: #fff;
  background: var(--brand_blue);
}
.spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 12px;
  border: 3px solid var(--graph_bg_thick);
  border-top-color: var(--brand_blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
