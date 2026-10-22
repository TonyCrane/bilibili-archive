// 站点配置的默认值与解析逻辑（不依赖 Vite 运行时，vite.config.ts 也会使用）。
// 可在 web/.env 中覆盖（参考 web/.env.example）：未设置的项使用默认值，设为空则不显示（标题除外）。

export const SITE_DEFAULTS = {
  title: 'BiliBili 补档原视频信息查询',
  description: '保存原视频的稿件信息、封面与完整评论区，方便在补档后对照查阅。',
  repoUrl: 'https://github.com/TonyCrane/bilibili-archive',
}

export interface SiteConfig {
  title: string
  description: string
  repoUrl: string
}

export function resolveSite(env: Record<string, string | boolean | undefined>): SiteConfig {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)
  return {
    title: str(env.VITE_SITE_TITLE) || SITE_DEFAULTS.title,
    description: str(env.VITE_SITE_DESCRIPTION) ?? SITE_DEFAULTS.description,
    repoUrl: str(env.VITE_REPO_URL) ?? SITE_DEFAULTS.repoUrl,
  }
}
