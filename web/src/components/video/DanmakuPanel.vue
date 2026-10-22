<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../Icon.vue'
import type { Danmaku, DanmakuData } from '../../types'
import { loadDanmaku, toast } from '../../composables/app'

// 弹幕列表（仿网页端右侧「弹幕列表」），可搜索并导出为 B 站 XML 弹幕文件
const props = defineProps<{ bvid: string; count: number; mobile?: boolean }>()
const open = ref(false)
const data = ref<DanmakuData | null>(null)
const loading = ref(false)
const kw = ref('')
const sort = ref<'progress' | 'ctime'>('progress')
const page = ref(0) // 0 = 全部分P
const LIMIT = 1500

async function toggle() {
  open.value = !open.value
  if (open.value && !data.value && !loading.value) {
    loading.value = true
    try {
      data.value = await loadDanmaku(props.bvid)
    } finally {
      loading.value = false
    }
  }
}

const filtered = computed<Danmaku[]>(() => {
  const d = data.value
  if (!d) return []
  const k = kw.value.trim().toLowerCase()
  const cid = page.value ? d.pages[page.value - 1]?.cid : 0
  const out = d.items.filter(x => (!cid || x[9] === cid) && (!k || x[5].toLowerCase().includes(k)))
  return sort.value === 'progress' ? out : [...out].sort((a, b) => a[4] - b[4])
})

const pad = (n: number) => String(n).padStart(2, '0')
function progress(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
function sent(ts: number) {
  const d = new Date(ts * 1000)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const color = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`
const MODE: Record<number, string> = { 4: '底', 5: '顶', 6: '逆', 7: '高级' }

const esc = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    // XML 1.0 不允许的控制字符
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

/** 导出与 B 站接口一致的 XML 弹幕（可直接用于播放器 / 补档） */
function exportXml() {
  const d = data.value
  if (!d) return
  const groups = page.value ? [d.pages[page.value - 1]] : d.pages.length ? d.pages : [{ cid: d.items[0]?.[9] ?? 0, page: 1, part: '' }]
  for (const g of groups) {
    const items = d.items.filter(x => x[9] === g.cid || d.pages.length <= 1)
    const lines = items.map(x =>
      `  <d p="${(x[0] / 1000).toFixed(5)},${x[1]},${x[2]},${x[3]},${x[4]},${x[8]},${x[6]},${x[7]},0">${esc(x[5])}</d>`)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<i>\n  <chatserver>chat.bilibili.com</chatserver>\n  <chatid>${g.cid}</chatid>\n  <mission>0</mission>\n  <maxlimit>${items.length}</maxlimit>\n  <state>0</state>\n  <real_name>0</real_name>\n  <source>k-v</source>\n${lines.join('\n')}\n</i>\n`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
    a.download = groups.length > 1 || d.pages.length > 1 ? `${props.bvid}_P${g.page}.xml` : `${props.bvid}.xml`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  toast('已导出 XML 弹幕文件')
}
</script>

<template>
  <div class="dm-panel" :class="{ mobile, open }">
    <button class="dm-head" @click="toggle">
      <span class="dm-title">弹幕列表</span>
      <span class="dm-count">{{ count }} 条存档</span>
      <Icon name="down" :size="16" class="arrow" />
    </button>
    <div v-if="open" class="dm-body">
      <div v-if="loading" class="dm-tip">正在读取弹幕…</div>
      <div v-else-if="!data" class="dm-tip">读取弹幕失败</div>
      <template v-else>
        <div class="dm-tools">
          <input v-model.trim="kw" type="search" placeholder="搜索弹幕" />
          <select v-if="data.pages.length > 1" v-model="page">
            <option :value="0">全部分P</option>
            <option v-for="(p, i) in data.pages" :key="p.cid" :value="i + 1">P{{ p.page }}</option>
          </select>
          <button class="dm-btn" :title="sort === 'progress' ? '按视频时间排序' : '按发送时间排序'" @click="sort = sort === 'progress' ? 'ctime' : 'progress'">
            <Icon name="sort" :size="14" />{{ sort === 'progress' ? '时间' : '发送' }}
          </button>
          <button class="dm-btn" title="导出 B 站 XML 弹幕" @click="exportXml">XML</button>
        </div>
        <div class="dm-row dm-th">
          <span class="t">时间</span><span class="c">弹幕内容（{{ filtered.length }}）</span><span class="s">发送时间</span>
        </div>
        <div class="dm-list">
          <div v-for="x in filtered.slice(0, LIMIT)" :key="x[7]" class="dm-row" :title="`${x[5]}\n发送者哈希：${x[6]}`">
            <span class="t">{{ progress(x[0]) }}</span>
            <span class="c">
              <i v-if="(x[3] & 0xffffff) !== 0xffffff" class="dot" :style="{ background: color(x[3]) }" />
              <i v-if="MODE[x[1]]" class="mode">{{ MODE[x[1]] }}</i>{{ x[5] }}
            </span>
            <span class="s">{{ sent(x[4]) }}</span>
          </div>
          <div v-if="filtered.length > LIMIT" class="dm-tip">仅显示前 {{ LIMIT }} 条，可搜索或导出 XML 查看全部</div>
          <div v-if="!filtered.length" class="dm-tip">没有匹配的弹幕</div>
        </div>
        <div class="dm-foot">弹幕抓取于 {{ data.fetchedAt }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dm-panel {
  border-radius: 6px;
  background: var(--bg2);
  overflow: hidden;
}
.dm-head {
  display: flex;
  align-items: center;
  width: 100%;
  height: 44px;
  padding: 0 16px;
  text-align: left;
}
.dm-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text1);
}
.dm-count {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text3);
}
.arrow {
  margin-left: auto;
  color: var(--text3);
  transition: transform 0.2s;
}
.open .arrow {
  transform: rotate(180deg);
}
.dm-body {
  padding: 0 12px 10px;
}
.dm-tools {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.dm-tools input,
.dm-tools select {
  height: 28px;
  border: 1px solid var(--line_regular);
  border-radius: 4px;
  background: var(--bg1);
  color: var(--text1);
  font-size: 12px;
  outline: none;
}
.dm-tools input {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}
.dm-tools input:focus {
  border-color: var(--brand_blue);
}
.dm-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text2);
  background: var(--graph_bg_thick);
  white-space: nowrap;
}
.dm-btn:hover {
  color: var(--brand_blue);
}
.dm-list {
  max-height: 360px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text2);
}
.dm-row:not(.dm-th):hover {
  background: var(--graph_bg_thick);
}
.dm-th {
  color: var(--text3);
}
.t {
  flex: none;
  width: 40px;
  font-variant-numeric: tabular-nums;
}
.c {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text1);
}
.dm-th .c {
  color: var(--text3);
}
.s {
  flex: none;
  width: 76px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-radius: 50%;
  vertical-align: 0;
  box-shadow: 0 0 0 1px var(--line_regular);
}
.mode {
  margin-right: 4px;
  padding: 0 3px;
  border-radius: 2px;
  font-size: 10px;
  font-style: normal;
  color: var(--brand_blue);
  background: var(--brand_blue_thin);
}
.dm-tip,
.dm-foot {
  padding: 8px 0 2px;
  text-align: center;
  font-size: 12px;
  color: var(--text3);
}
.mobile {
  border-radius: 8px;
}
.mobile .dm-list {
  max-height: 50vh;
}
</style>
