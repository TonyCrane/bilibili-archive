<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { setTitle } from '../router'

setTitle('页面不存在')
</script>

<template>
  <AppHeader />
  <div class="not-found">
    <p class="code">404</p>
    <p>页面不存在</p>
    <RouterLink to="/" class="home">返回首页</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  padding: 120px 20px;
  text-align: center;
  color: var(--text2);
}
.code {
  margin: 0;
  font-size: 64px;
  font-weight: 700;
  color: var(--brand_blue);
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
</style>
