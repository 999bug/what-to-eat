/**
 * swCache 纯逻辑单测：缓存裁剪与旧缓存清理判定。
 * SW 主体依赖 ServiceWorkerGlobalScope，jsdom 跑不了，所以逻辑全部抽在
 * lib/swCache.ts，这里只测纯函数（Cache 用最小桩代替）。
 */
import { describe, expect, it } from 'vitest'
import {
  CURRENT_RUNTIME_CACHE_NAMES,
  HTML_SHELL_MAX_ENTRIES,
  isPrunableCache,
  trimCache,
} from '@/lib/swCache'

/** 最小 Cache 桩：keys 返回按插入序的 Request，delete 按 URL 字符串移除 */
function fakeCache(urls: string[]): Cache {
  const store = new Set(urls)
  return {
    keys: async () => [...store].map((u) => new Request(u)),
    delete: async (req: RequestInfo | URL) => {
      const key = typeof req === 'string' ? req : req instanceof URL ? req.href : req.url
      return store.delete(key)
    },
  } as unknown as Cache
}

describe('trimCache', () => {
  it('未超上限时不动任何条目', async () => {
    const cache = fakeCache(['https://a/x', 'https://a/y'])
    expect(await trimCache(cache, HTML_SHELL_MAX_ENTRIES)).toBe(0)
    expect(await trimCache(cache, 2)).toBe(0)
  })

  it('超上限时按插入序淘汰最旧', async () => {
    const cache = fakeCache(['https://a/oldest', 'https://a/mid', 'https://a/newest'])
    expect(await trimCache(cache, 2)).toBe(1)
    const rest = await cache.keys()
    expect(rest.map((r) => r.url)).toEqual(['https://a/mid', 'https://a/newest'])
  })

  it('maxEntries 非正数时不做任何事', async () => {
    const cache = fakeCache(['https://a/x'])
    expect(await trimCache(cache, 0)).toBe(0)
    expect(await trimCache(cache, -1)).toBe(0)
  })
})

describe('isPrunableCache', () => {
  it('当前在用的自有缓存不清理', () => {
    for (const name of CURRENT_RUNTIME_CACHE_NAMES) {
      expect(isPrunableCache(name)).toBe(false)
    }
  })

  it('自有前缀的历史遗留缓存要清理', () => {
    expect(isPrunableCache('html-shell-v1')).toBe(true)
    expect(isPrunableCache('lazy-assets-2024')).toBe(true)
  })

  it('同源其它应用的缓存绝不能碰', () => {
    expect(isPrunableCache('workbox-precache-v2')).toBe(false)
    expect(isPrunableCache('cycling-analyzer-tiles')).toBe(false)
    expect(isPrunableCache('amap-tiles')).toBe(false)
  })
})
