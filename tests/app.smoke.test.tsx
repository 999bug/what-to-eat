/**
 * 应用冒烟测试：在 jsdom 里真实挂载 App，跑一遍主要导航与关键交互。
 * 目的不是测样式，而是保证「首屏能渲染 + 切页不崩 + 抽取后能记入」。
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import App from '@/App'

// React 19 act 环境开关
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mountApp() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<App />)
  })
  return container
}

/** 按可见文本找按钮并点击 */
function clickText(container: HTMLElement, text: string) {
  const btn = [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes(text),
  )
  if (!btn) throw new Error(`未找到按钮：${text}`)
  act(() => {
    btn.click()
  })
}

/** 按 aria-label 找开关并点击 */
function clickAria(container: HTMLElement, label: string) {
  const btn = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!btn) throw new Error(`未找到开关：${label}`)
  act(() => {
    btn.click()
  })
}

describe('App 冒烟', () => {
  it('首屏渲染抽签页：餐次、菜系、抽取按钮都在', () => {
    const c = mountApp()
    expect(c.textContent).toContain('早餐')
    expect(c.textContent).toContain('午餐')
    expect(c.textContent).toContain('晚餐')
    expect(c.textContent).toContain('家常菜')
    expect(c.textContent).toContain('今天吃什么')
    expect(c.textContent).toContain('候选')
  })

  it('底部导航切换到日历 / 统计 / 设置', () => {
    const c = mountApp()
    clickText(c, '日历')
    expect(c.textContent).toContain('本月概览')
    expect(c.textContent).toContain('已记录天数')

    clickText(c, '统计')
    expect(c.textContent).toContain('本月菜系分布')
    expect(c.textContent).toContain('每日热量趋势')

    clickText(c, '设置')
    expect(c.textContent).toContain('抽签偏好')
    expect(c.textContent).toContain('关于')
  })

  it('开启夜宵后抽签页出现四个餐次', () => {
    const c = mountApp()
    clickText(c, '设置')
    clickAria(c, '切换夜宵')
    clickText(c, '抽签')
    expect(c.textContent).toContain('夜宵')
  })

  it('日历页「抽一抽」能写入选中日期的记录', () => {
    const c = mountApp()
    clickText(c, '日历')
    const before = c.querySelectorAll('.item').length
    clickText(c, '抽一抽')
    expect(c.querySelectorAll('.item').length).toBe(before + 1)
    expect(c.textContent).toContain('kcal')
  })
})
