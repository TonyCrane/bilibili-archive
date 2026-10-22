<script setup lang="ts">
import { onMounted, watch } from 'vue'
import Icon from '../Icon.vue'
import PcComment from './PcComment.vue'
import type { CommentList } from '../../composables/comments'
import { useInfinite } from '../../composables/app'

const props = defineProps<{ list: CommentList; total: number; openSub: string }>()
const { sort, keyword, visible, hasMore, loadMore, matchCount, items } = props.list
const { el: sentinel, start } = useInfinite(loadMore)
onMounted(start)
watch(visible, () => setTimeout(start))
</script>

<template>
  <section class="comments">
    <div class="navbar">
      <div class="title">
        <h2>评论</h2>
        <span class="count">{{ total }}</span>
      </div>
      <div class="sort-actions" :class="sort">
        <button @click="sort = 'hot'">最热</button>
        <span class="sort-div" />
        <button @click="sort = 'time'">最新</button>
      </div>
    </div>

    <div class="searchbox">
      <div class="search-avatar"><Icon name="search" :size="22" /></div>
      <label class="search-edit">
        <input v-model.trim="keyword" type="search" placeholder="在存档中搜索评论内容、用户名、UID 或 rpid" />
        <button v-if="keyword" class="clear" aria-label="清除" @click="keyword = ''"><Icon name="close" :size="14" /></button>
      </label>
    </div>
    <div v-if="keyword" class="search-tip">
      找到 <b>{{ matchCount }}</b> 条包含「{{ keyword }}」的评论（涉及 {{ items.length }} 个楼层）
    </div>

    <div class="contents">
      <PcComment
        v-for="it in visible"
        :key="it.root.id"
        :comment="it.root"
        :matches="it.matches"
        :open-sub="openSub"
      />
    </div>
    <div ref="sentinel" class="bottombar">
      <template v-if="hasMore">正在加载…</template>
      <template v-else-if="items.length">没有更多评论</template>
      <template v-else-if="keyword">没有找到相关评论</template>
      <template v-else>还没有评论存档</template>
    </div>
  </section>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  height: 28px;
  margin-bottom: 22px;
}
.title {
  display: flex;
  align-items: center;
}
.title h2 {
  margin: 0;
  color: var(--text1);
  font-weight: 500;
  font-size: 20px;
}
.count {
  margin: 0 30px 0 6px;
  font-size: 13px;
  color: var(--text3);
}
.sort-actions {
  display: flex;
  align-items: center;
}
.sort-actions button {
  height: 28px;
  padding: 0 6px;
  font-size: 13px;
  color: var(--text3);
}
.sort-actions button:hover {
  color: var(--brand_blue);
}
.sort-actions.hot button:first-child,
.sort-actions.time button:last-child {
  color: var(--text1);
}
.sort-div {
  display: inline-block;
  height: 11px;
  margin: 0 3px;
  border-left: 1px solid var(--text3);
}
.searchbox {
  display: flex;
  height: 50px;
}
.search-avatar {
  flex-shrink: 0;
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
}
.search-edit {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  border-radius: 6px;
  background: var(--bg3);
  border: 1px solid var(--bg3);
  transition: 0.2s;
}
.search-edit:focus-within {
  background: var(--bg1);
  border-color: var(--brand_blue);
}
.search-edit input {
  flex: 1;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 40px 0 12px;
  font-size: 13px;
  color: var(--text1);
}
.search-edit input::placeholder {
  color: var(--text3);
}
.search-edit input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  position: absolute;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
}
.clear:hover {
  color: var(--text1);
  background: var(--graph_bg_thick);
}
.search-tip {
  margin: 14px 0 0 80px;
  font-size: 13px;
  color: var(--text2);
}
.search-tip b {
  color: var(--brand_pink);
  font-weight: 500;
}
.contents {
  padding-top: 14px;
}
.bottombar {
  width: 100%;
  margin-top: 20px;
  padding-bottom: 100px;
  font-size: 13px;
  color: var(--text3);
  text-align: center;
}
</style>
