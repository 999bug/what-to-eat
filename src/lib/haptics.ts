/**
 * 触觉反馈（唯一入口）。
 * 约束：不支持的平台（iOS Safari / 桌面）静默降级，绝不抛错、绝不阻塞交互；
 * 强度分级与使用场景对应，新增场景请在此追加，不要在组件里直接调 navigator.vibrate。
 */

/** 是否支持振动 API（iOS Safari 至今不支持，返回 false） */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** 用户是否开启了系统「减弱动态效果」（开启时一律不振动） */
function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 内部：安全触发，忽略一切异常 */
function fire(pattern: number | number[]): void {
  if (!canVibrate() || reducedMotion()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // 部分浏览器在无用户手势时抛错，忽略即可
  }
}

export const haptics = {
  /** 轻点：按钮、chip、tab 切换（12ms） */
  tap: () => fire(12),
  /** 极轻：转盘每跨过一个扇区边界（8ms，高频调用，务必短） */
  tick: () => fire(8),
  /** 中等：餐次切换、模式切换（16ms） */
  select: () => fire(16),
  /** 抽出结果：双脉冲，模拟「抽中」的确认感 */
  hit: () => fire([0, 30, 40, 60]),
  /** 警示：无候选、导入失败等（三连短震） */
  warn: () => fire([0, 18, 60, 18, 60, 18]),
}
