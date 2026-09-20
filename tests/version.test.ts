/**
 * 版本比较与远端版本探测。
 * 更新提示的唯一判定口径在这里：本地版本取构建注入的 __APP_VERSION__，
 * 远端取部署目录的 version.json，二者比较决定首页是否出现「有新版本」入口。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRemoteVersion, isNewer, parseVersion } from '@/lib/version'

describe('parseVersion', () => {
  it('解析三段版本号，允许 v 前缀', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('v2.0.0')).toEqual([2, 0, 0])
  })

  it('缺位补 0，非法段记 0', () => {
    expect(parseVersion('1.2')).toEqual([1, 2, 0])
    expect(parseVersion('1')).toEqual([1, 0, 0])
    expect(parseVersion('1.x.3')).toEqual([1, 0, 3])
    expect(parseVersion('')).toEqual([0, 0, 0])
  })
})

describe('isNewer', () => {
  it('远端更高时为 true', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('1.1.0', '1.0.9')).toBe(true)
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
  })

  it('相等或更旧时为 false', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
  })

  it('位数不同也能正确比较', () => {
    expect(isNewer('1.1', '1.0.9')).toBe(true)
    expect(isNewer('1.1.0', '1.1')).toBe(false)
  })
})

describe('fetchRemoteVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('读到版本号时返回该字符串', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ version: '9.9.9' }), { status: 200 })),
    )
    await expect(fetchRemoteVersion()).resolves.toBe('9.9.9')
  })

  it('请求失败或格式异常时返回 null（不打扰用户）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    await expect(fetchRemoteVersion()).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ foo: 1 }), { status: 200 })),
    )
    await expect(fetchRemoteVersion()).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(fetchRemoteVersion()).resolves.toBeNull()
  })
})
