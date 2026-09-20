/** 统计口径：热量、覆盖率、连续天数、每日序列（跨面板数字必须出自同一函数） */
import { describe, expect, it } from 'vitest'
import { activeMeals, dayKcal, isKcalKnown, monthStat, recordsOn, unknownCountOn } from '@/lib/stats'
import type { MealId, MealRecord } from '@/types'

const rec = (date: string, meal: MealId, kcal: number, cuisine = 'home'): MealRecord => ({
  id: date + meal,
  date,
  meal,
  dishId: 'd1',
  dishName: '测试菜',
  icon: '🍚',
  cuisine,
  servings: 1,
  kcal,
  source: 'seed',
  createdAt: '',
})

const RS: MealRecord[] = [
  rec('2026-09-01', 'b', 400),
  rec('2026-09-01', 'l', 600),
  rec('2026-09-02', 'd', 500, 'chuan'),
]

describe('recordsOn / dayKcal', () => {
  it('按日期取记录并求和', () => {
    expect(recordsOn(RS, '2026-09-01')).toHaveLength(2)
    expect(dayKcal(RS, '2026-09-01')).toBe(1000)
    expect(dayKcal(RS, '2026-09-03')).toBe(0)
  })
})

describe('activeMeals', () => {
  it('夜宵开关控制餐位数', () => {
    expect(activeMeals(false)).toEqual(['b', 'l', 'd'])
    expect(activeMeals(true)).toEqual(['b', 'l', 'd', 'm'])
  })
})

describe('monthStat', () => {
  const st = monthStat(RS, '2026-09', false)

  it('当月天数取真实天数', () => {
    expect(st.dim).toBe(30)
  })

  it('已记录天数与总热量', () => {
    expect(st.days).toBe(2)
    expect(st.total).toBe(1500)
  })

  it('日均除以已记录天数，不是当月天数', () => {
    expect(st.avg).toBe(750)
  })

  it('覆盖率 = 已记餐次 / (已记天数 × 餐位数)', () => {
    // 2 天 × 3 餐位 = 6，实际记了 2 + 1 = 3
    expect(st.cover).toBe(50)
  })

  it('菜系分布按次数倒序', () => {
    expect(st.cuisines[0]).toEqual({ id: 'home', n: 2 })
    expect(st.cuisines[1]).toEqual({ id: 'chuan', n: 1 })
  })

  it('每日序列长度为当月天数，未记录为 0', () => {
    expect(st.daily).toHaveLength(30)
    expect(st.daily[0]).toBe(1000)
    expect(st.daily[1]).toBe(500)
    expect(st.daily[2]).toBe(0)
  })

  it('空记录不产生 NaN', () => {
    const empty = monthStat([], '2026-09', false)
    expect(empty.days).toBe(0)
    expect(empty.avg).toBe(0)
    expect(empty.cover).toBe(0)
  })

  it('夜宵开启后覆盖率分母变大', () => {
    const on = monthStat(RS, '2026-09', true)
    expect(on.cover).toBe(38) // 3 / (2 × 4)
  })
})

/**
 * 未知热量口径（手动录入菜品未填热量）：
 * kcal 记 0，但**不能**参与日均分母，否则等于把「未知」当「0 卡」拉低均值。
 * 老数据没有 kcalKnown 字段，必须按已知处理，不能因为这次改动而变动历史统计。
 */
describe('monthStat · 未知热量口径', () => {
  /** 已知热量 1000 (day1) + 未知 (day2) + 已知 500 (day3) */
  const MIXED: MealRecord[] = [
    rec('2026-09-01', 'l', 1000),
    { ...rec('2026-09-02', 'l', 0), kcalKnown: false },
    rec('2026-09-03', 'd', 500),
  ]

  it('总量只累加已知热量', () => {
    expect(monthStat(MIXED, '2026-09', false).total).toBe(1500)
  })

  it('日均分母只数「有已知热量」的天，未知天不进分母', () => {
    // 1500 / 2（day1、day3）= 750，而不是 1500 / 3 = 500
    expect(monthStat(MIXED, '2026-09', false).avg).toBe(750)
  })

  it('已记录天数仍包含只有未知热量的那天（覆盖率和连续天数按此口径）', () => {
    const st = monthStat(MIXED, '2026-09', false)
    expect(st.days).toBe(3)
    expect(st.unknownDays).toBe(1)
    expect(st.unknownCount).toBe(1)
  })

  it('每日序列里未知那天记 0（序列无法表达未知，靠 unknownDays 提示）', () => {
    const st = monthStat(MIXED, '2026-09', false)
    expect(st.daily[0]).toBe(1000)
    expect(st.daily[1]).toBe(0)
    expect(st.daily[2]).toBe(500)
  })

  it('全部未知时不产生 NaN，日均为 0', () => {
    const allUnknown: MealRecord[] = [
      { ...rec('2026-09-01', 'l', 0), kcalKnown: false },
      { ...rec('2026-09-02', 'd', 0), kcalKnown: false },
    ]
    const st = monthStat(allUnknown, '2026-09', false)
    expect(st.total).toBe(0)
    expect(st.avg).toBe(0)
    expect(Number.isNaN(st.avg)).toBe(false)
    expect(st.unknownDays).toBe(2)
    expect(st.unknownCount).toBe(2)
  })

  it('无未知记录时 unknownDays/unknownCount 为 0', () => {
    const st = monthStat(RS, '2026-09', false)
    expect(st.unknownDays).toBe(0)
    expect(st.unknownCount).toBe(0)
  })

  it('缺省 kcalKnown 的旧数据一律按已知处理，历史统计不变', () => {
    const legacy: MealRecord[] = [rec('2026-09-01', 'l', 800)]
    expect(legacy[0].kcalKnown).toBeUndefined()
    const withField: MealRecord[] = [{ ...rec('2026-09-01', 'l', 800), kcalKnown: true }]
    const a = monthStat(legacy, '2026-09', false)
    const b = monthStat(withField, '2026-09', false)
    expect(a.avg).toBe(b.avg)
    expect(a.total).toBe(b.total)
    expect(a.unknownCount).toBe(0)
  })

  it('同一天既有已知又有未知：该天进分母，只加已知那部分', () => {
    const sameDay: MealRecord[] = [
      rec('2026-09-01', 'l', 600),
      { ...rec('2026-09-01', 'd', 0), kcalKnown: false },
    ]
    const st = monthStat(sameDay, '2026-09', false)
    expect(st.total).toBe(600)
    expect(st.avg).toBe(600) // 600 / 1 天
    expect(st.unknownDays).toBe(1)
  })
})

describe('isKcalKnown / unknownCountOn', () => {
  it('缺省视为已知，显式 false 才是未知', () => {
    expect(isKcalKnown(rec('2026-09-01', 'l', 100))).toBe(true)
    expect(isKcalKnown({ ...rec('2026-09-01', 'l', 0), kcalKnown: true })).toBe(true)
    expect(isKcalKnown({ ...rec('2026-09-01', 'l', 0), kcalKnown: false })).toBe(false)
  })

  it('unknownCountOn 按天统计未知条数', () => {
    const rs: MealRecord[] = [
      { ...rec('2026-09-01', 'l', 0), kcalKnown: false },
      { ...rec('2026-09-01', 'd', 0), kcalKnown: false },
      rec('2026-09-02', 'l', 500),
    ]
    expect(unknownCountOn(rs, '2026-09-01')).toBe(2)
    expect(unknownCountOn(rs, '2026-09-02')).toBe(0)
  })
})
