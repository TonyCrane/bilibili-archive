<script setup lang="ts">
import { computed } from 'vue'
import type { VideoDetail } from '../../types'
import { spaceUrl } from '../../utils/format'

// 视频简介：desc_v2 中 type=2 为 @用户；文本中的链接 / BV 号自动转为链接
const props = defineProps<{ video: VideoDetail }>()
const LINK_RE = /(https?:\/\/[^\s，。！？、“”"'<>（）()]+|BV1[0-9A-Za-z]{9}|av\d{2,})/g

type Seg = { text: string; href?: string }
const segs = computed<Seg[]>(() => {
  const parts = props.video.descV2.length
    ? props.video.descV2
    : [{ raw_text: props.video.desc, type: 1, biz_id: 0 }]
  const out: Seg[] = []
  for (const p of parts) {
    if (p.type === 2) {
      out.push({ text: `@${p.raw_text}`, href: spaceUrl(p.biz_id) })
      continue
    }
    let last = 0
    for (const m of p.raw_text.matchAll(LINK_RE)) {
      const i = m.index ?? 0
      if (i > last) out.push({ text: p.raw_text.slice(last, i) })
      const t = m[0]
      out.push({ text: t, href: t.startsWith('http') ? t : `https://www.bilibili.com/video/${t}` })
      last = i + t.length
    }
    if (last < p.raw_text.length) out.push({ text: p.raw_text.slice(last) })
  }
  return out
})
</script>

<template>
  <span class="desc-text"><template v-for="(s, i) in segs" :key="i"><a v-if="s.href" :href="s.href" target="_blank" rel="noreferrer">{{ s.text }}</a><template v-else>{{ s.text }}</template></template></span>
</template>

<style scoped>
.desc-text {
  white-space: pre-line;
  word-break: break-word;
}
a {
  color: var(--text_link);
}
a:hover {
  color: var(--brand_blue);
}
</style>
