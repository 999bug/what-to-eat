/**
 * 设备与偏好判定（纯函数，全部做 API 判空，SSR / jsdom 下安全）。
 * 约束：断点数值必须与 index.css 的 @media 保持一致，改一处要同时改另一处。
 */

/** 与 index.css 断点一致的手机/平板分界 */
export const MOBILE_BREAKPOINT = 768

/** 是否手机宽度（<768px）。jsdom 下可显式传 width 便于测试 */
export function isMobileWidth(width?: number): boolean {
  if (typeof width === 'number') return width < MOBILE_BREAKPOINT
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

/** 用户是否开启系统「减弱动态效果」 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 系统当前是否暗色 */
export function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 是否已作为 PWA 独立窗口运行（「添加到主屏幕」后为 true） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')
  if (mq?.matches) return true
  // iOS Safari 私有属性
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
