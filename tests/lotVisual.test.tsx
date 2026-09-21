/**
 * 抽签桶签牌的视觉契约校验。
 *
 * 为什么不用计算样式断言：项目测试环境是 jsdom，且 setup 里没有加载 index.css
 * （见 vite.config.ts / tests/setup.ts），getComputedStyle 拿不到样式表结果，
 * 对 ::before 伪元素更是直接返回空。因此改为「解析 CSS 源码 + 校验结构」：
 * 这类断言同样能钉死回归，而且不依赖浏览器实现细节。
 *
 * 背景：签牌曾是单个 🎴 emoji，既无质感也不受主题控制。改回/退化成占位符、
 * 或深色主题被漏掉，都会在这里被拦下。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { DrawPage } from '@/pages/DrawPage'
import { useAppStore } from '@/stores/useAppStore'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const RAW_CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
/** 去掉注释，避免注释里出现的属性名/选择器干扰匹配 */
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** 取出某个选择器块的声明体（只匹配最外层，够用） */
function blockOf(selector: string): string {
  // 转义选择器里的特殊字符，按字面量定位
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{([^}]*)\\}')
  const m = CSS.match(re)
  if (!m) throw new Error('CSS 里找不到选择器：' + selector)
  return m[1]
}

function declOf(selector: string, prop: string): string {
  const body = blockOf(selector)
  const m = body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)'))
  if (!m) throw new Error(`${selector} 里找不到属性 ${prop}`)
  return m[1].trim()
}

/** 取底色：CSS 里可能写成 background（简写）或 background-color */
function bgOf(selector: string): string {
  const body = blockOf(selector)
  // 先找 background-color，再退回 background 简写（简写里可能带其它值，取第一个像颜色的片段）
  const direct = body.match(/(?:^|[;\s])background-color\s*:\s*([^;]+)/)
  if (direct) return direct[1].trim()
  const short = body.match(/(?:^|[;\s])background\s*:\s*([^;]+)/)
  if (!short) throw new Error(`${selector} 里找不到背景色`)
  const val = short[1].trim()
  // 纯色简写直接返回；带多值时取第一个像颜色的片段
  const colorish = val.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\)|var\(--[\w-]+\))/i)
  return (colorish ? colorish[1] : val).trim()
}

/** 把 hex 或 rgb() 解析成三元组 */
function toRGB(v: string): [number, number, number] {
  const hex = v.trim().match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgb = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  throw new Error('无法解析颜色：' + v)
}

/** WCAG 相对亮度 */
function relLum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relLum(a)
  const l2 = relLum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function mountLots(): HTMLElement {
  useAppStore.setState({ view: 'draw', result: null })
  useAppStore.getState().setMode('lots')
  useAppStore.getState().refreshCandidates()

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<DrawPage />)
  })
  return container
}

describe('抽签桶签牌视觉', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.body.innerHTML = ''
  })

  it('结构：每支签都有实体签身与签面，不再是单个 emoji 占位', () => {
    const c = mountLots()
    const lots = c.querySelectorAll('.lot')
    expect(lots.length).toBeGreaterThan(0)

    for (const lot of lots) {
      expect(lot.querySelector('.lot-body')).not.toBeNull()
      expect(lot.querySelector('.lot-face')).not.toBeNull()
      // 旧实现是直接塞 '🎴'
      expect(lot.textContent?.includes('🎴')).toBe(false)
    }
  })

  it('签身是暖木色，且明确不是纯白底（项目硬约束）', () => {
    const [r, g, b] = toRGB(bgOf('.lot-body'))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    expect(r - b).toBeGreaterThan(15)
    expect(r === 255 && g === 255 && b === 255).toBe(false)
  })

  it('签头紧贴顶部、有可见高度、且是红系', () => {
    const body = blockOf('.lot-body::before')
    expect(body).toMatch(/top:\s*0/)
    const h = body.match(/height:\s*([\d.]+)px/)
    expect(h).not.toBeNull()
    expect(Number(h![1])).toBeGreaterThan(4)

    // 签头用的是强调色 token（番茄红），而不是写死的颜色
    expect(body).toMatch(/background:\s*var\(--accent\)/)
  })

  it('签面「食／签」竖排', () => {
    expect(declOf('.lot-cap', 'writing-mode')).toBe('vertical-rl')
    expect(declOf('.lot-mark', 'writing-mode')).toBe('vertical-rl')
  })

  it('签面文字与签身对比度 ≥ 3:1（UI 组件标准）', () => {
    const face = toRGB(bgOf('.lot-body'))
    const ink = toRGB(declOf('.lot-cap', 'color'))
    expect(contrast(face, ink)).toBeGreaterThan(3)
  })

  it('深色主题单独覆写了签身与签面颜色，且正文仍可读', () => {
    const darkBg = toRGB(bgOf("[data-theme='dark'] .lot-body"))
    // 仍是暖色
    expect(darkBg[0]).toBeGreaterThan(darkBg[1])
    expect(darkBg[1]).toBeGreaterThan(darkBg[2])
    // 在近黑背景上亮度足够，不会糊掉
    expect(relLum(darkBg)).toBeGreaterThan(0.25)

    const darkInk = toRGB(declOf("[data-theme='dark'] .lot-cap", 'color'))
    expect(contrast(darkBg, darkInk)).toBeGreaterThan(3)
  })

  it('中奖签去掉红签头（整支变红时不该再叠一道红条）', () => {
    // 中奖签的签头 opacity 归零
    expect(blockOf('.lot.win .lot-body::before')).toMatch(/opacity:\s*0/)
    // 中奖签底色用强调色 token
    expect(bgOf('.lot.win .lot-body')).toMatch(/var\(--accent-soft\)/)
  })

  it('reduced-motion 下摇签与位移动效被关闭', () => {
    const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/\.lot\.shake \.lot-body\s*\{\s*animation:\s*none/)
  })

  it('点签牌进入摇签态：签身加 .shake 且所有签禁用防连点', () => {
    const c = mountLots()
    const first = c.querySelector<HTMLButtonElement>('.lot')!
    act(() => {
      first.click()
    })
    expect(c.querySelectorAll('.lot.shake').length).toBeGreaterThan(0)
    for (const lot of c.querySelectorAll<HTMLButtonElement>('.lot')) {
      expect(lot.disabled).toBe(true)
    }
  })
})
