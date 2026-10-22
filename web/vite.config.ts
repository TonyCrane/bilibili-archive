import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import archive from './plugins/archive'
import { resolveSite } from './src/site'

const root = fileURLToPath(new URL('.', import.meta.url))
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// 存档目录可通过环境变量 ARCHIVE_DIR 覆盖，部署到子路径时设置 BASE_URL（如 /archive/）
export default defineConfig(({ mode }) => {
  const site = resolveSite(loadEnv(mode, root, 'VITE_'))
  return {
    base: process.env.BASE_URL || '/',
    plugins: [
      vue(),
      archive({ dir: process.env.ARCHIVE_DIR || '../archive' }),
      {
        // 把站点标题 / 简介写入 index.html
        name: 'site-meta',
        transformIndexHtml: html =>
          html
            .replaceAll('%SITE_TITLE%', escapeHtml(site.title))
            .replaceAll('%SITE_DESCRIPTION%', escapeHtml(site.description)),
      },
    ],
    server: { port: 5173 },
    build: { chunkSizeWarningLimit: 1000 },
  }
})
