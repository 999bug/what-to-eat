/**
 * 测试环境初始化。
 * - jsdom 未实现 canvas，这里把 getContext 打成返回 null（Wheel 内部已判空），避免刷屏告警
 * - jsdom 未实现 matchMedia，补一个可控 stub（默认匹配 false，即浅色 + 弱动效未开启）：
 *   主题默认 'auto'、Wheel 的 prefersReducedMotion、App 的断点监听都依赖它
 * - vitest 解析不了 vite 插件注入的 PWA 虚拟模块（UpdateBanner 引用），
 *   这里 mock 成常态 API（needRefresh=false），冒烟测试才能真实挂载 App
 * - 每个用例后清理 DOM
 */
import { afterEach, vi } from 'vitest'

HTMLCanvasElement.prototype.getContext = () => null

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, () => {}],
    needRefresh: [false, () => {}],
    updateServiceWorker: () => {},
  }),
}))

/** 可控的 matchMedia stub：测试里可直接改 window.__matchMediaMatches 切换匹配结果 */
declare global {
  interface Window {
    __matchMediaMatches?: boolean
    __matchMediaListeners?: Array<(e: { matches: boolean }) => void>
  }
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => {
    const listeners: Array<(e: { matches: boolean }) => void> = []
    window.__matchMediaListeners = listeners
    return {
      get matches() {
        return window.__matchMediaMatches === true
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb)
      },
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        const i = listeners.indexOf(cb)
        if (i >= 0) listeners.splice(i, 1)
      },
      addListener: (cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb)
      },
      removeListener: (cb: (e: { matches: boolean }) => void) => {
        const i = listeners.indexOf(cb)
        if (i >= 0) listeners.splice(i, 1)
      },
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
}

afterEach(() => {
  document.body.innerHTML = ''
  window.__matchMediaMatches = false
})
