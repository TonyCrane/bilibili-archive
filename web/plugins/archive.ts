/**
 * Vite 插件：自动读取存档目录（默认 ../archive）。
 *   开发时  /data/index.json、/data/video/<BV>.json、/data/danmaku/<BV>.json、/media/<BV>/... 由中间件实时生成 / 提供，
 *           存档（含 archive/reupload.json）变化后自动刷新页面；
 *   构建时  生成同样路径的静态文件，并把图片复制到 dist/media/。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { buildDanmaku, buildIndex, buildVideo, listArchived } from './normalize'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
}

export default function archivePlugin(options: { dir: string }): Plugin {
  const dir = path.resolve(options.dir)
  let config: ResolvedConfig

  return {
    name: 'bilibili-archive',

    configResolved(c) {
      config = c
    },

    configureServer(server) {
      const base = config.base
      server.watcher.add(dir)
      let timer: NodeJS.Timeout | undefined
      const reload = (file: string) => {
        if (!file.startsWith(dir) || /\.(tmp|part)$/.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(() => server.ws.send({ type: 'full-reload' }), 500)
      }
      server.watcher.on('change', reload)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)

      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0])
        if (!url.startsWith(base)) return next()
        const rel = url.slice(base.length)
        const json = (data: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(JSON.stringify(data))
        }
        if (rel === 'data/index.json') return json(buildIndex(dir, base))
        let m = rel.match(/^data\/video\/(BV[0-9A-Za-z]{10})\.json$/)
        if (m) {
          const payload = buildVideo(dir, m[1], base)
          if (!payload) {
            res.statusCode = 404
            return res.end('not found')
          }
          return json(payload)
        }
        m = rel.match(/^data\/danmaku\/(BV[0-9A-Za-z]{10})\.json$/)
        if (m) {
          const payload = buildDanmaku(dir, m[1])
          if (!payload) {
            res.statusCode = 404
            return res.end('not found')
          }
          return json(payload)
        }
        m = rel.match(/^media\/(BV[0-9A-Za-z]{10})\/(.+)$/)
        if (m) {
          const file = path.join(dir, m[1], 'media', m[2])
          if (!file.startsWith(path.join(dir, m[1], 'media') + path.sep) || !fs.existsSync(file)) {
            res.statusCode = 404
            return res.end('not found')
          }
          res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          return fs.createReadStream(file).pipe(res)
        }
        next()
      })
    },

    generateBundle() {
      const base = config.base
      this.emitFile({ type: 'asset', fileName: 'data/index.json', source: JSON.stringify(buildIndex(dir, base)) })
      for (const bvid of listArchived(dir)) {
        const payload = buildVideo(dir, bvid, base)
        if (payload) this.emitFile({ type: 'asset', fileName: `data/video/${bvid}.json`, source: JSON.stringify(payload) })
        const dm = buildDanmaku(dir, bvid)
        if (dm) this.emitFile({ type: 'asset', fileName: `data/danmaku/${bvid}.json`, source: JSON.stringify(dm) })
      }
    },

    closeBundle() {
      if (config.command !== 'build') return
      const out = path.resolve(config.root, config.build.outDir)
      for (const bvid of listArchived(dir)) {
        const src = path.join(dir, bvid, 'media')
        if (fs.existsSync(src)) {
          fs.cpSync(src, path.join(out, 'media', bvid), {
            recursive: true,
            filter: f => !/\.(tmp|part)$/.test(f),
          })
        }
      }
      // 方便直接部署到静态托管：未知路径回退到单页应用
      const index = path.join(out, 'index.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(out, '404.html'))
    },
  }
}
