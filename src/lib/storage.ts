/**
 * localStorage 读写（唯一入口）。
 * 约束：UI 组件禁止直接碰 localStorage，一律经 store 的 actions；
 * 解析失败静默降级为默认值，不阻塞页面（file:// 下部分浏览器会禁 localStorage）。
 */

const KEY = 'wte:v1:'

// localStorage 不可用时的内存兜底（仅当前会话有效）
const mem = new Map<string, unknown>()

export function loadItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY + key)
    if (raw == null) return (mem.get(key) as T) ?? fallback
    return JSON.parse(raw) as T
  } catch {
    return (mem.get(key) as T) ?? fallback
  }
}

export function saveItem(key: string, value: unknown): void {
  mem.set(key, value)
  try {
    localStorage.setItem(KEY + key, JSON.stringify(value))
  } catch {
    // 忽略：隐私模式 / 配额满时保持内存态
  }
}

export function removeItem(key: string): void {
  mem.delete(key)
  try {
    localStorage.removeItem(KEY + key)
  } catch {
    // 忽略
  }
}
