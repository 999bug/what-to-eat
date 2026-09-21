/**
 * 自定义 SW（vite-plugin-pwa injectManifest 模式）。
 *
 * 更新体验核心：导航请求网络优先——在线时每次页面加载都拉最新 index.html，
 * 用户刷新一次即得新版；离线时逐级兜底：
 * ①该路由上次成功拉取的 HTML → ②预缓存的 SPA 壳。
 *
 * SW 自身走浏览器标准更新流：导航时比对 sw.js 字节 → 新 SW 后台 install
 * → skipWaiting + clientsClaim 立即激活 → 清理旧缓存，全程静默。
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  /** vite-plugin-pwa 构建时注入的预缓存清单 */
  __WB_MANIFEST: ReadonlyArray<{ url: string; revision: string | null }>
}

import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import {
  HTML_SHELL_CACHE_NAME,
  HTML_SHELL_MAX_ENTRIES,
  isPrunableCache,
  LAZY_ASSETS_CACHE_NAME,
  LAZY_ASSETS_MAX_ENTRIES,
  trimCache,
} from './lib/swCache'

/** 导航请求网络响应超时：弱网/挂起时 3 秒后回退缓存，不让用户干等 */
const NAV_TIMEOUT_MS = 3000

// 预缓存应用壳资源（清单由构建注入）
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA 壳地址：预缓存清单中的 index.html 条目。
// workbox 以修订键存储预缓存条目，普通 caches.match 命不中，必须走官方映射
const serveShell = createHandlerBoundToURL('index.html')

registerRoute(
  // 所有页面导航（含刷新/深链/首次加载）走网络优先
  new NavigationRoute(async ({ event, request, url }) => {
    const cache = await caches.open(HTML_SHELL_CACHE_NAME)
    const cached = await cache.match(request.url)
    try {
      // AbortSignal.timeout 需 Safari 16+/Chrome 103+：旧浏览器不传超时
      // 直连网络（兜底链仍然有效），避免 API 缺失同步抛错导致永远拿缓存旧版
      const init: RequestInit | undefined =
        typeof AbortSignal.timeout === 'function'
          ? { signal: AbortSignal.timeout(NAV_TIMEOUT_MS) }
          : undefined
      const network = await fetch(request, init)
      if (network.status === 200) {
        // 以 URL 字符串为键写入（规避 navigate 模式 Request 的 Cache.put 限制）
        await cache.put(request.url, network.clone())
        await trimCache(cache, HTML_SHELL_MAX_ENTRIES)
        return network
      }
    } catch {
      // 网络异常（离线/超时/挂起）：落入下方兜底链
    }
    // 回退缓存的同时后台静默 revalidate：本次先给旧版保证可用，
    // 缓存已被最新 HTML 覆盖，下次刷新即是新版
    event.waitUntil(
      fetch(request)
        .then(async (res) => {
          if (res.status === 200) {
            await cache.put(request.url, res.clone())
            await trimCache(cache, HTML_SHELL_MAX_ENTRIES)
          }
        })
        .catch(() => {}),
    )
    if (cached) return cached
    // 缓存中无该路由 HTML（离线首访或深链）：回退预缓存 SPA 壳
    return serveShell({ event, request, url })
  }),
)

// 未预缓存的懒加载 chunk 走 SWR 运行时缓存：首次在线使用后离线可用。
// 正则由 SW scope 推导，与部署子路径解耦
registerRoute(
  new RegExp(
    `^${self.registration.scope.replace(/[/\\]/g, '\\$&')}assets/[^/]+\\.(js|css)$`,
  ),
  new StaleWhileRevalidate({
    cacheName: LAZY_ASSETS_CACHE_NAME,
    plugins: [new ExpirationPlugin({ maxEntries: LAZY_ASSETS_MAX_ENTRIES })],
  }),
)

// ⚠️ 必须手写：autoUpdate 模式下插件不会发送 SKIP_WAITING 消息，
// SW 必须在 install 后自行立即接管——缺了这步新 SW 永远卡在 waiting，
// 页面挂多久都不会自动更新（cycling-analyzer 实测踩坑）。消息监听保留作兜底。
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})
// 激活时只清理本应用自有前缀的旧缓存（同源安全，见 lib/swCache.ts）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => isPrunableCache(name)).map((name) => caches.delete(name)),
        ),
      )
      .catch(() => {}),
  )
})
clientsClaim()
