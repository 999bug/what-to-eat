/**
 * 品牌位（左上角 logo）行为契约。
 *
 * 需求：logo 常驻左上角、点击回到首页，并顺手把抽签页的筛选中态清掉。
 * 这里断言三件事：
 *   1. 侧栏与手机顶栏各有一个 .rail-brand / .topbar-brand，且都是可点的 button
 *   2. 从别的视图点 logo 会切回抽签首页
 *   3. 点 logo 会清掉残留筛选（"回到干净首页"），但不动忌口等长期偏好
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { useAppStore } from '@/stores/useAppStore'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mountApp(): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<App />)
  })
  return container
}

function click(btn: HTMLElement) {
  act(() => {
    btn.click()
  })
}

describe('左上角品牌位', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    useAppStore.setState({ view: 'draw', sheet: null })
  })

  it('侧栏品牌位是一个可点的 button，带无障碍名称', () => {
    const c = mountApp()
    const brand = c.querySelector<HTMLButtonElement>('.rail-brand')
    expect(brand).not.toBeNull()
    expect(brand!.tagName).toBe('BUTTON')
    expect(brand!.getAttribute('aria-label')).toBe('回到首页')
    // 里面必须是 logo 图 + 品牌名
    expect(brand!.querySelector('img')).not.toBeNull()
    expect(brand!.textContent).toContain('今天吃什么')
  })

  it('手机端顶栏也有品牌位（小屏没有侧栏）', () => {
    // useMobile() 用 isMobileWidth() 取 window.innerWidth 作初值，
    // 所以要把视口改窄再挂载（jsdom 默认 1024）
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    window.__matchMediaMatches = true

    const c = mountApp()
    const brand = c.querySelector<HTMLButtonElement>('.topbar-brand')
    expect(brand).not.toBeNull()
    expect(brand!.getAttribute('aria-label')).toBe('回到首页')
    expect(brand!.querySelector('img')).not.toBeNull()

    Object.defineProperty(window, 'innerWidth', { value: original, configurable: true })
  })

  it('在设置页点 logo 会回到抽签首页', () => {
    const c = mountApp()
    // 先切到设置页
    const settingsTab = [...c.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('设置'),
    )!
    click(settingsTab)
    expect(useAppStore.getState().view).toBe('settings')

    // 点左上角 logo
    click(c.querySelector<HTMLButtonElement>('.rail-brand')!)
    expect(useAppStore.getState().view).toBe('draw')
  })

  it('点 logo 会清掉残留筛选，但不碰忌口等长期偏好', () => {
    const c = mountApp()
    act(() => {
      useAppStore.getState().toggleCuisine('chuan')
      useAppStore.getState().toggleTag('spicy')
      useAppStore.getState().toggleAvoid('cilantro')
      useAppStore.getState().nav('stats')
    })
    expect(useAppStore.getState().filters.cuisines).toContain('chuan')

    click(c.querySelector<HTMLButtonElement>('.rail-brand')!)

    const st = useAppStore.getState()
    expect(st.view).toBe('draw')
    expect(st.filters.cuisines).toEqual([])
    expect(st.filters.tags).toEqual([])
    expect(st.filters.levels).toEqual([])
    // 忌口属于长期偏好，回首页不该被清掉
    expect(st.settings.avoid).toContain('cilantro')
    // 回到首页要重新补齐候选池
    expect(st.candidates.length).toBeGreaterThan(0)
  })
})
