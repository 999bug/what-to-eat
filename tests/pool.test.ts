/** 抽取口径：候选池过滤、忌口硬过滤、加权抽取与候选去重上限 */
import { describe, expect, it } from 'vitest'
import { avoidHit, pickCandidates, pickWeighted, poolForMeal, weightFor } from '@/lib/pool'
import { DISHES } from '@/data/dishes'
import type { MealRecord } from '@/types'
import { todayStr } from '@/lib/date'

const rec = (dishId: string, date: string): MealRecord => ({
  id: dishId + date,
  date,
  meal: 'l',
  dishId,
  dishName: 'x',
  icon: '🍚',
  cuisine: 'home',
  servings: 1,
  kcal: 500,
  source: 'seed',
  createdAt: '',
})

describe('poolForMeal', () => {
  it('按餐次过滤', () => {
    const pool = poolForMeal('b', [], [], [])
    expect(pool.length).toBeGreaterThan(0)
    for (const d of pool) expect(d.meals).toContain('b')
  })

  it('按菜系过滤（多菜系菜取交集）', () => {
    const pool = poolForMeal('l', ['chuan'], [], [])
    expect(pool.length).toBeGreaterThan(0)
    for (const d of pool) expect(d.cuisines).toContain('chuan')
  })

  it('多菜系为并集', () => {
    const chuan = poolForMeal('l', ['chuan'], [], []).length
    const yue = poolForMeal('l', ['yue'], [], []).length
    const both = poolForMeal('l', ['chuan', 'yue'], [], []).length
    expect(both).toBeGreaterThanOrEqual(Math.max(chuan, yue))
  })

  it('按口味标签过滤', () => {
    const pool = poolForMeal('l', [], ['jianzhi'], [])
    for (const d of pool) expect(d.tags).toContain('jianzhi')
  })

  it('按难度过滤（多档为并集）', () => {
    const easy = poolForMeal('l', [], [], [], [1])
    expect(easy.length).toBeGreaterThan(0)
    for (const d of easy) expect(d.level).toBe(1)

    const easyMid = poolForMeal('l', [], [], [], [1, 2])
    for (const d of easyMid) expect([1, 2]).toContain(d.level)
    expect(easyMid.length).toBeGreaterThan(easy.length)
  })

  it('忌口为硬过滤：辣与牛羊肉都不出现', () => {
    const pool = poolForMeal('l', [], [], ['spicy', 'mutton'])
    for (const d of pool) {
      expect(avoidHit(d, ['spicy', 'mutton'])).toBe(false)
      expect(d.tags).not.toContain('spicy')
      expect(d.name + d.ingredients).not.toMatch(/牛|羊/)
    }
  })
})

describe('weightFor', () => {
  it('7 天内吃过 ×0.3，收藏 ×1.5', () => {
    const d = DISHES[1]
    expect(weightFor(d, [], [], false)).toBe(1)
    expect(weightFor(d, [rec(d.id, todayStr())], [], true)).toBeCloseTo(0.3)
    expect(weightFor(d, [], [d.id], true)).toBeCloseTo(1.5)
    expect(weightFor(d, [rec(d.id, '2020-01-01')], [], true)).toBe(1)
  })
})

describe('pickWeighted / pickCandidates', () => {
  const pool = poolForMeal('l', [], [], [])

  it('抽中的一定在池内；排除列表生效', () => {
    const exclude = pool.slice(0, 3).map((d) => d.id)
    for (let i = 0; i < 30; i++) {
      const hit = pickWeighted(pool, [], [], false, exclude)
      expect(hit).not.toBeNull()
      expect(pool).toContain(hit)
      expect(exclude).not.toContain(hit!.id)
    }
  })

  it('排除项铺满全池时回退，不返回 null', () => {
    const all = pool.map((d) => d.id)
    expect(pickWeighted(pool, [], [], false, all)).not.toBeNull()
  })

  it('候选最多 8 个且互不重复', () => {
    const cs = pickCandidates(pool, [], [], false)
    expect(cs.length).toBe(8)
    expect(new Set(cs.map((d) => d.id)).size).toBe(cs.length)
  })

  it('池子不足 8 个时按池子大小返回', () => {
    const small = poolForMeal('m', [], [], [])
    if (small.length < 8) {
      expect(pickCandidates(small, [], [], false).length).toBe(small.length)
    }
  })

  it('空池返回 null / 空数组', () => {
    expect(pickWeighted([], [], [], false)).toBeNull()
    expect(pickCandidates([], [], [], false)).toHaveLength(0)
  })
})
