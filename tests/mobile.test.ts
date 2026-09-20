/**
 * 移动端基础能力单测：device 判定 + haptics 降级。
 * 重点覆盖「不支持的平台必须静默降级、绝不抛错」这条硬约束。
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { isMobileWidth, prefersDark, prefersReducedMotion, MOBILE_BREAKPOINT } from '@/lib/device'
import { canVibrate, haptics } from '@/lib/haptics'

/** 临时替换 matchMedia，返回还原函数 */
function mockMatchMedia(matches: boolean) {
  const original = window.matchMedia
  window.matchMedia = ((q: string) => ({
    matches,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe('device 断点判定', () => {
  it('断点值与 index.css 的 768 保持一致', () => {
    expect(MOBILE_BREAKPOINT).toBe(768)
  })

  it('isMobileWidth 按显式宽度判定', () => {
    expect(isMobileWidth(375)).toBe(true)
    expect(isMobileWidth(390)).toBe(true)
    expect(isMobileWidth(767)).toBe(true)
    expect(isMobileWidth(768)).toBe(false)
    expect(isMobileWidth(1440)).toBe(false)
  })
})

describe('device 偏好判定', () => {
  const restores: (() => void)[] = []

  afterEach(() => {
    restores.splice(0).forEach((r) => r())
  })

  it('prefersReducedMotion 跟随系统设置', () => {
    restores.push(mockMatchMedia(true))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('prefersReducedMotion 未开启时为 false', () => {
    restores.push(mockMatchMedia(false))
    expect(prefersReducedMotion()).toBe(false)
  })

  it('prefersDark 跟随系统设置', () => {
    restores.push(mockMatchMedia(true))
    expect(prefersDark()).toBe(true)
  })

  it('matchMedia 不可用时两个判定都安全返回 false', () => {
    const original = window.matchMedia
    // @ts-expect-error 故意移除以验证判空分支
    delete window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
    expect(prefersDark()).toBe(false)
    window.matchMedia = original
  })
})

describe('haptics 降级与强度分级', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('不支持振动 API 时 canVibrate 为 false（iOS Safari 场景）', () => {
    const original = navigator.vibrate
    // @ts-expect-error 故意移除
    delete navigator.vibrate
    expect(canVibrate()).toBe(false)
    // 调用不应抛错
    expect(() => haptics.tap()).not.toThrow()
    expect(() => haptics.hit()).not.toThrow()
    navigator.vibrate = original
  })

  it('支持时按场景传入不同时长', () => {
    const spy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true })

    const restore = mockMatchMedia(false) // 关闭减弱动态效果，确保会振动
    haptics.tick()
    haptics.tap()
    haptics.select()
    haptics.hit()
    restore()

    expect(spy).toHaveBeenCalledTimes(4)
    expect(spy).toHaveBeenNthCalledWith(1, 8) // tick 最短，高频调用
    expect(spy).toHaveBeenNthCalledWith(2, 12)
    expect(spy).toHaveBeenNthCalledWith(3, 16)
    expect(spy).toHaveBeenNthCalledWith(4, [0, 30, 40, 60]) // hit 双脉冲
  })

  it('开启减弱动态效果时完全不振动', () => {
    const spy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true })
    const restore = mockMatchMedia(true)

    haptics.tap()
    haptics.hit()

    restore()
    expect(spy).not.toHaveBeenCalled()
  })

  it('vibrate 抛错时被吞掉，不向外传播', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('blocked by user gesture policy')
      },
      configurable: true,
    })
    const restore = mockMatchMedia(false)
    expect(() => haptics.tap()).not.toThrow()
    restore()
  })
})
