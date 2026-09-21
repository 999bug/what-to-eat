/**
 * 桌面端滚轮可滚动的守卫测试。
 *
 * 背景：`overscroll-behavior-y: none` 曾写在 html/body 上，
 * 侧栏 .rail 又用了 position: sticky —— 根滚动容器被判定为「不可滚动链」时，
 * 桌面端滚轮事件就不会驱动页面滚动（用户报「鼠标滚轮上下滑动无反应」）。
 * 现在该属性被限制在触屏媒体查询里。
 *
 * 这条用例锁死三点：
 *   1. html/body 不再无条件设 overscroll-behavior
 *   2. 该属性只在 (hover: none) and (pointer: coarse) 的触屏查询内出现
 *   3. 没有给根元素加 overflow: hidden 这类会掐断页面滚动的写法
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAW_CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
/** 去掉注释后的 CSS——否则注释里提到的属性名会被误计为声明 */
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** 取出 html, body 的顶层样式块 */
function htmlBodyBlock(): string {
  const m = CSS.match(/html,\s*body\s*\{([^}]*)\}/)
  if (!m) throw new Error('找不到 html, body 样式块')
  return m[1]
}

describe('桌面端页面可滚动', () => {
  it('html/body 不再无条件禁用纵向 overscroll', () => {
    const body = htmlBodyBlock()
    expect(body).not.toMatch(/overscroll-behavior/)
  })

  it('overscroll-behavior-y: none 只出现在触屏媒体查询里', () => {
    // 找到触屏查询块
    const m = CSS.match(/@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/)
    expect(m).not.toBeNull()
    const touchBlock = m![1]
    expect(touchBlock).toMatch(/overscroll-behavior-y:\s*none/)

    // 全文件里 overscroll-behavior 的出现次数 == 触屏块内的次数
    const all = CSS.match(/overscroll-behavior/g) ?? []
    const inTouch = touchBlock.match(/overscroll-behavior/g) ?? []
    expect(all.length).toBe(inTouch.length)
  })

  it('根元素没有被设成 overflow: hidden（那会直接掐断页面滚动）', () => {
    const body = htmlBodyBlock()
    expect(body).not.toMatch(/overflow(-y)?:\s*hidden/)
    // 横向裁剪是允许的，但必须是 overflow-x
    if (/overflow/.test(body)) expect(body).toMatch(/overflow-x:\s*(hidden|clip)/)
  })

  it('主区不设固定高度，内容靠根滚动条自然滚动', () => {
    const m = CSS.match(/\.main\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    // .main 不应出现 height: 100vh / overflow-y: auto 这类自建滚动容器
    expect(m![1]).not.toMatch(/height:\s*100vh/)
    expect(m![1]).not.toMatch(/overflow-y:\s*(auto|scroll)/)
  })
})
