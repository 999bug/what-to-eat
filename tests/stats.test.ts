/** 统计口径：热量、覆盖率、连续天数、每日序列（跨面板数字必须出自同一函数） */
import { describe, expect, it } from 'vitest'
import { activeMeals, dayKcal, monthStat, recordsOn } from '@/lib/stats'
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
