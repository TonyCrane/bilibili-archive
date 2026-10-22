<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import ThemeToggle from './ThemeToggle.vue'
import logo from '../assets/bili-logo.svg?raw'
import { parseVideoId } from '../utils/search'
import { REPO_URL, SITE_SHORT_TITLE } from '../config'

const route = useRoute()
const router = useRouter()
const q = ref(String(route.query.q || ''))
watch(() => route.query.q, v => (q.value = String(v || '')))

async function submit() {
  const text = q.value.trim()
  const id = parseVideoId(text)
  if (id) return router.push(`/video/${id}`)
  router.push({ path: '/', query: text ? { q: text } : {} })
}
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <RouterLink to="/" class="brand" title="返回首页">
        <span class="logo" v-html="logo" />
        <span class="divider" />
        <span class="site">{{ SITE_SHORT_TITLE }}</span>
      </RouterLink>
      <form class="search" role="search" @submit.prevent="submit">
        <input v-model="q" type="search" placeholder="搜索存档：标题 / UP主 / 标签 / BV号 / av号" />
        <button type="submit" aria-label="搜索"><Icon name="search" :size="17" /></button>
      </form>
      <div class="right">
        <ThemeToggle />
        <a v-if="REPO_URL" class="icon-link" :href="REPO_URL" target="_blank" rel="noreferrer" title="GitHub" aria-label="GitHub 仓库">
          <Icon name="github" :size="18" />
        </a>
        <a class="entry" href="https://www.bilibili.com" target="_blank" rel="noreferrer">
          <Icon name="link" :size="16" />B站首页
        </a>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bg1);
  box-shadow: var(--header-shadow);
}
.inner {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 24px;
  gap: 24px;
}
.brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--brand_blue);
}
.logo {
  display: flex;
}
.logo :deep(svg) {
  height: 30px;
  width: auto;
}
.divider {
  width: 1px;
  height: 18px;
  margin: 0 12px;
  background: var(--line_regular);
}
.site {
  font-size: 15px;
  font-weight: 500;
  color: var(--text1);
  white-space: nowrap;
}
.search {
  flex: 1;
  max-width: 500px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 4px 0 12px;
  border: 1px solid var(--line_regular);
  border-radius: 8px;
  background: var(--graph_bg_regular);
  transition: 0.2s;
}
.search:focus-within {
  background: var(--bg1);
  border-color: var(--brand_blue);
}
.search input {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--text1);
}
.search input::placeholder {
  color: var(--text3);
}
.search button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text1);
}
.search button:hover {
  background: var(--graph_bg_thick);
}
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.icon-link {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
}
.icon-link:hover {
  background: var(--graph_bg_regular);
  color: var(--text1);
}
.entry {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text1);
}
.entry:hover {
  background: var(--graph_bg_regular);
}
@media (max-width: 1000px) {
  .site,
  .divider,
  .entry {
    display: none;
  }
}
</style>
