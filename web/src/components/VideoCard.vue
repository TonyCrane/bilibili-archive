<script setup lang="ts">
import Icon from './Icon.vue'
import type { VideoSummary } from '../types'
import { count, duration, shortDate, thumb } from '../utils/format'

defineProps<{ video: VideoSummary }>()
</script>

<template>
  <RouterLink class="video-card" :to="`/video/${video.bvid}`">
    <div class="cover">
      <img :src="thumb(video.cover, 672, 378)" alt="" loading="lazy" />
      <div class="mask">
        <span class="stat"><Icon name="play" :size="18" />{{ video.statKnown ? count(video.stat.view) : '—' }}</span>
        <span class="stat"><Icon name="danmaku" :size="18" />{{ video.statKnown ? count(video.stat.danmaku) : '—' }}</span>
        <span class="dur">{{ duration(video.duration) }}</span>
      </div>
      <span v-if="!video.status.ok" class="badge" :class="video.reupload.length ? 'reup' : 'dead'">
        {{ video.status.message || '已失效' }} · {{ video.reupload.length ? '已补档' : '暂未补档' }}
      </span>
      <span v-else-if="video.comments" class="badge">评论 {{ count(video.comments.total) }}</span>
    </div>
    <div class="info">
      <h3 class="title" :title="video.title">{{ video.title }}</h3>
      <div class="owner">
        <svg class="up-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M6.15 8.24805C6.5642 8.24805 6.9 8.58383 6.9 8.99805L6.9 12.7741C6.9 13.5881 7.55988 14.248 8.3739 14.248C9.18791 14.248 9.8478 13.5881 9.8478 12.7741L9.8478 8.99805C9.8478 8.58383 10.1836 8.24805 10.5978 8.24805C11.012 8.24805 11.3478 8.58383 11.3478 8.99805L11.3478 12.7741C11.3478 14.41655 10.01635 15.748 8.3739 15.748C6.73146 15.748 5.4 14.41655 5.4 12.7741L5.4 8.99805C5.4 8.58383 5.73578 8.24805 6.15 8.24805z" fill="currentColor"></path><path d="M12.6522 8.99805C12.6522 8.58383 12.98795 8.24805 13.4022 8.24805L15.725 8.24805C17.31285 8.24805 18.6 9.53522 18.6 11.123C18.6 12.71085 17.31285 13.998 15.725 13.998L14.1522 13.998L14.1522 14.998C14.1522 15.4122 13.8164 15.748 13.4022 15.748C12.98795 15.748 12.6522 15.4122 12.6522 14.998L12.6522 8.99805zM14.1522 12.498L15.725 12.498C16.4844 12.498 17.1 11.8824 17.1 11.123C17.1 10.36365 16.4844 9.74804 15.725 9.74804L14.1522 9.74804L14.1522 12.498z" fill="currentColor"></path><path d="M12 4.99805C9.48178 4.99805 7.283 5.12616 5.73089 5.25202C4.65221 5.33949 3.81611 6.16352 3.72 7.23254C3.60607 8.4998 3.5 10.171 3.5 11.998C3.5 13.8251 3.60607 15.4963 3.72 16.76355C3.81611 17.83255 4.65221 18.6566 5.73089 18.7441C7.283 18.8699 9.48178 18.998 12 18.998C14.5185 18.998 16.7174 18.8699 18.2696 18.74405C19.3481 18.65655 20.184 17.8328 20.2801 16.76405C20.394 15.4973 20.5 13.82645 20.5 11.998C20.5 10.16965 20.394 8.49877 20.2801 7.23205C20.184 6.1633 19.3481 5.33952 18.2696 5.25205C16.7174 5.12618 14.5185 4.99805 12 4.99805zM5.60965 3.75693C7.19232 3.62859 9.43258 3.49805 12 3.49805C14.5677 3.49805 16.8081 3.62861 18.3908 3.75696C20.1881 3.90272 21.6118 5.29278 21.7741 7.09773C21.8909 8.3969 22 10.11405 22 11.998C22 13.88205 21.8909 15.5992 21.7741 16.8984C21.6118 18.7033 20.1881 20.09335 18.3908 20.23915C16.8081 20.3675 14.5677 20.498 12 20.498C9.43258 20.498 7.19232 20.3675 5.60965 20.2392C3.81206 20.0934 2.38831 18.70295 2.22603 16.8979C2.10918 15.5982 2 13.8808 2 11.998C2 10.1153 2.10918 8.39787 2.22603 7.09823C2.38831 5.29312 3.81206 3.90269 5.60965 3.75693z" fill="currentColor"></path></svg>
        <span class="name ellipsis">{{ video.owner.name }}</span>
        <span class="date">· {{ shortDate(video.pubdate) }}</span>
      </div>
      <div class="archived">存档于 {{ (video.updatedAt || video.archivedAt).slice(0, 16) }}</div>
    </div>
  </RouterLink>
</template>

<style scoped>
.video-card {
  display: block;
  min-width: 0;
}
.cover {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: var(--graph_bg_regular);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}
.video-card:hover .cover img {
  transform: scale(1.04);
}
.mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 8px 6px;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.dur {
  margin-left: auto;
}
.badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
}
.badge.dead {
  background: var(--warn);
}
.badge.reup {
  background: var(--brand_pink);
}
.info {
  padding-top: 8px;
}
.title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  height: 44px;
  color: var(--text1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-all;
  transition: color 0.2s;
}
.video-card:hover .title {
  color: var(--brand_blue);
}
.owner {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text3);
}
.up-icon {
  flex-shrink: 0;
}
.date {
  flex-shrink: 0;
}
.archived {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text4);
}
@media (max-width: 767px) {
  .cover {
    border-radius: 4px;
  }
  .mask {
    gap: 8px;
    font-size: 11px;
    padding: 12px 6px 4px;
  }
  .mask .icon {
    width: 14px;
    height: 14px;
  }
  .title {
    font-size: 13px;
    line-height: 18px;
    height: 36px;
    font-weight: 400;
  }
  .owner {
    font-size: 11px;
  }
  .up-icon {
    width: 14px;
    height: 14px;
  }
  .archived {
    font-size: 10px;
  }
}
</style>
