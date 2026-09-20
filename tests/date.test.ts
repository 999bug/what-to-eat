/** 日期纯函数：一律本地时区，不做跨时区换算 */
import { describe, expect, it } from 'vitest'
import { addMonths, daysBetween, daysInMonth, monthOf, pad, parseYmd, prettyDate, ymd } from '@/lib/date'

describe('pad / ymd / parseYmd', () => {
  it('个位数补零，两位数原样', () => {
    expect(pad(9)).toBe('09')
    expect(pad(10)).toBe('10')
  })

  it('Date 与本地日期串互转不丢精度', () => {
    const d = new Date(2026, 8, 20) // 2026-09-20 本地零点
    expect(ymd(d)).toBe('2026-09-20')
    const back = parseYmd('2026-09-20')
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(8)
    expect(back.getDate()).toBe(20)
  })
})

describe('daysInMonth', () => {
  it('平年 2 月 28 天，闰年 29 天', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
  })

  it('大小月正确', () => {
    expect(daysInMonth('2026-01')).toBe(31)
    expect(daysInMonth('2026-04')).toBe(30)
  })
})

describe('monthOf / addMonths', () => {
  it('取月份片段', () => {
    expect(monthOf('2026-09-20')).toBe('2026-09')
  })

  it('跨年平移', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-09', 3)).toBe('2026-12')
  })
})

describe('daysBetween', () => {
  it('取绝对值，跨月正确', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7)
    expect(daysBetween('2026-09-08', '2026-09-01')).toBe(7)
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1)
  })
})

describe('prettyDate', () => {
  it('输出「月日 周X」', () => {
    expect(prettyDate('2026-09-20')).toBe('9月20日 周日')
  })
})
