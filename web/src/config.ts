// 站点配置：web/.env 中的设置，未设置时使用 site.ts 中的默认值
import { resolveSite } from './site'

const site = resolveSite(import.meta.env)

export const SITE_TITLE = site.title
export const SITE_DESCRIPTION = site.description
export const REPO_URL = site.repoUrl

/** 顶栏 Logo 旁的站点名：去掉标题开头与 Logo 重复的「BiliBili」 */
export const SITE_SHORT_TITLE = SITE_TITLE.replace(/^bili\s*bili\s*/i, '') || SITE_TITLE
