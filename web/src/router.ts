import { createRouter, createWebHistory } from 'vue-router'
import { av2bv } from './utils/search'
import { SITE_TITLE } from './config'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    {
      path: '/video/:id',
      name: 'video',
      component: () => import('./views/VideoView.vue'),
      // 兼容 av 号链接
      beforeEnter: to => {
        const m = String(to.params.id).match(/^av(\d+)$/i)
        if (m) return { ...to, params: { id: av2bv(Number(m[1])) } }
      },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFound.vue') },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return false // 评论定位由页面自行处理
    return { top: 0 }
  },
})

export function setTitle(title?: string) {
  document.title = title ? `${title} - ${SITE_TITLE}` : SITE_TITLE
}

export default router
