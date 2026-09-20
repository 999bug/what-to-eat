/** 主题应用：写 data-theme 到 <html>，同步 theme-color（深浅两套底色） */
import type { Settings } from '@/types'

export type ResolvedTheme = 'light' | 'dark'

/** 与 index.css 中 --bg 保持一致的 meta 底色 */
const META_COLOR: Record<ResolvedTheme, string> = {
  light: '#F5F1EA',
  dark: '#1C1917',
}

/** auto 跟随系统，其余直接用设置值 */
export function resolveTheme(theme: Settings['theme']): ResolvedTheme {
  if (theme !== 'auto') return theme
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  return mq?.matches ? 'dark' : 'light'
}

export function applyTheme(theme: Settings['theme']): void {
  const resolved = resolveTheme(theme)
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', META_COLOR[resolved])
}
