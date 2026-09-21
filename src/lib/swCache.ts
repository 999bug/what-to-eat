/**
 * SW 运行时缓存策略（纯逻辑，抽出来方便单测——SW 主体依赖
 * ServiceWorkerGlobalScope，jsdom 跑不了）。
 *
 * ⚠️ 同源风险：GitHub Pages 用户站是同源共享（<user>.github.io 下所有仓库
 * 同一个 origin），CacheStorage 按 origin 隔离、不按路径隔离。因此绝不能
 * 无差别删除「不认识的缓存」——那会把同源的其它应用一起清掉。
 * 清理只允许针对本应用自有缓存。
 */

/** 导航 HTML 运行时缓存名（每次在线刷新覆盖为最新版） */
export const HTML_SHELL_CACHE_NAME = 'html-shell'

/** 懒加载 chunk 运行时缓存名（SWR 静默更新） */
export const LAZY_ASSETS_CACHE_NAME = 'lazy-assets'

/** 导航 HTML 缓存条目上限（深链会让 URL 持续增长，按插入序淘汰最旧） */
export const HTML_SHELL_MAX_ENTRIES = 20

/** 懒加载 chunk 缓存条目上限 */
export const LAZY_ASSETS_MAX_ENTRIES = 60

/** 本应用自有运行时缓存名（清理时予以保留；改名时旧名也留在此列表） */
export const CURRENT_RUNTIME_CACHE_NAMES: readonly string[] = [
  HTML_SHELL_CACHE_NAME,
  LAZY_ASSETS_CACHE_NAME,
]

/** 判断缓存是否为旧版本遗留（自有 + 不在当前使用清单） */
export function isPrunableCache(cacheName: string): boolean {
  return (
    CURRENT_RUNTIME_CACHE_NAMES.includes(cacheName) === false &&
    (cacheName === 'html-shell' ||
      cacheName === 'lazy-assets' ||
      cacheName.startsWith('html-shell') ||
      cacheName.startsWith('lazy-assets'))
  )
}

/** 把缓存裁剪到条目上限（按 Cache.keys() 插入序淘汰最旧） */
export async function trimCache(cache: Cache, maxEntries: number): Promise<number> {
  if (maxEntries <= 0) return 0
  const keys = await cache.keys()
  const overflow = keys.length - maxEntries
  if (overflow <= 0) return 0
  let removed = 0
  for (const request of keys.slice(0, overflow)) {
    if (await cache.delete(request)) removed += 1
  }
  return removed
}
