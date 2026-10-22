<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import type { CommentData, VideoDetail } from '../../types'
import { count, dateTime, duration } from '../../utils/format'
import { copyText } from '../../composables/app'

// 存档信息卡片：稿件编号、状态、存档时间、评论存档完整度、数据快照
const props = defineProps<{ video: VideoDetail; comments: CommentData | null; mobile?: boolean }>()

const rows = computed(() => {
  const v = props.video
  const c = v.comments
  const out: { label: string; value: string; copy?: string; href?: string }[] = [
    { label: 'BV号', value: v.bvid, copy: v.bvid },
    { label: 'av号', value: `av${v.aid}`, copy: `av${v.aid}` },
    { label: 'CID', value: String(v.cid), copy: String(v.cid) },
    { label: '时长', value: duration(v.duration) },
  ]
  if (v.tname) out.splice(3, 0, { label: '分区', value: v.tname })
  if (v.dimension?.width) out.push({ label: '分辨率', value: `${v.dimension.width}×${v.dimension.height}` })
  out.push(
    { label: '类型', value: v.copyright === 1 ? '自制' : '转载' },
    { label: '发布时间', value: dateTime(v.pubdate, true) },
    { label: '首次存档', value: v.firstArchivedAt || v.archivedAt || '—' },
    { label: '信息更新', value: v.updatedAt || '—' },
  )
  if (c) {
    out.push(
      { label: '评论存档', value: `${c.roots} 条评论 + ${c.subs} 条回复，共 ${c.total} 条` },
      { label: '站点计数', value: `${c.siteCount} 条（差值为已删除 / 审核中 / 被折叠的评论）` },
      { label: '评论抓取', value: c.crawlTime },
    )
  }
  out.push({ label: '原视频', value: `bilibili.com/video/${v.bvid}`, href: `https://www.bilibili.com/video/${v.bvid}/` })
  if (v.status.reason) out.splice(0, 0, { label: '失效原因', value: v.status.reason })
  if (v.danmaku !== null) out.push({ label: '弹幕存档', value: `${v.danmaku} 条` })
  return out
})
const gone = computed(() => props.comments?.roots.filter(r => r.gone).length ?? 0)
const snapshots = computed(() => props.video.snapshots.slice(-6).reverse())
</script>

<template>
  <div class="archive-info" :class="{ mobile }">
    <div class="head">
      <Icon name="archive" :size="18" />
      <span>存档信息</span>
      <span class="status" :class="{ bad: !video.status.ok }" :title="`检查于 ${video.status.checked_at}`">
        {{ video.status.ok ? '原视频正常' : `原视频${video.status.message || '已失效'}` }}
      </span>
    </div>
    <dl>
      <template v-for="r in rows" :key="r.label">
        <dt>{{ r.label }}</dt>
        <dd>
          <a v-if="r.href" :href="r.href" target="_blank" rel="noreferrer" class="link">{{ r.value }}</a>
          <template v-else>{{ r.value }}</template>
          <button v-if="r.copy" class="copy" title="复制" @click="copyText(r.copy)">复制</button>
        </dd>
      </template>
      <template v-if="video.reupload.length || !video.status.ok">
        <dt>补档视频</dt>
        <dd>
          <template v-if="video.reupload.length">
            <span v-for="r in video.reupload" :key="r.bvid" class="reup">
              <a :href="`https://www.bilibili.com/video/${r.bvid}/`" target="_blank" rel="noreferrer" class="link">{{ r.bvid }}</a>
              <RouterLink v-if="r.archived" :to="`/video/${r.bvid}`" class="copy">查看存档</RouterLink>
            </span>
          </template>
          <span v-else class="muted">暂未补档</span>
        </dd>
      </template>
      <template v-if="video.reuploadOf.length">
        <dt>补档自</dt>
        <dd>
          <span v-for="o in video.reuploadOf" :key="o.bvid" class="reup">
            <RouterLink v-if="o.archived" :to="`/video/${o.bvid}`" class="link">{{ o.bvid }}（存档）</RouterLink>
            <a v-else :href="`https://www.bilibili.com/video/${o.bvid}/`" target="_blank" rel="noreferrer" class="link">{{ o.bvid }}</a>
          </span>
        </dd>
      </template>
      <template v-if="gone">
        <dt>已删除</dt>
        <dd>{{ gone }} 条主评论在最近一次抓取时已不在原视频中（仍保留于存档）</dd>
      </template>
    </dl>
    <template v-if="snapshots.length">
      <div class="sub-title">数据快照</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>时间</th><th>播放</th><th>点赞</th><th>投币</th><th>收藏</th><th>评论</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in snapshots" :key="s.time">
              <td>{{ s.time.slice(5, 16) }}</td>
              <td>{{ count(s.stat.view) }}</td>
              <td>{{ count(s.stat.like) }}</td>
              <td>{{ count(s.stat.coin) }}</td>
              <td>{{ count(s.stat.favorite) }}</td>
              <td>{{ count(s.stat.reply) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.archive-info {
  padding: 14px 16px;
  border-radius: 6px;
  background: var(--bg2);
  font-size: 13px;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text1);
}
.status {
  margin-left: auto;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}
.status.bad {
  color: var(--warn);
  background: var(--warn_thin);
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
}
dt {
  color: var(--text3);
  white-space: nowrap;
}
dd {
  margin: 0;
  color: var(--text1);
  word-break: break-all;
}
.link {
  color: var(--text_link);
}
.reup + .reup {
  margin-left: 10px;
}
.muted {
  color: var(--text3);
}
.copy {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text3);
}
.copy:hover {
  color: var(--brand_blue);
}
.sub-title {
  margin: 14px 0 6px;
  font-weight: 500;
  color: var(--text1);
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 4px 4px;
  text-align: right;
  white-space: nowrap;
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  font-weight: 400;
  color: var(--text3);
  border-bottom: 1px solid var(--line_regular);
}
td {
  color: var(--text2);
}
.mobile {
  border-radius: 8px;
}
</style>
