/** 菜库数据体检：id / 菜名唯一、热量区间、餐次合法、搜索串可用 */
import { describe, expect, it } from 'vitest'
import { DISHES } from '@/data/dishes'
import { CUISINES, TAG_META } from '@/data/meta'

describe('菜库完整性', () => {
  it('数量为 160 道', () => {
    expect(DISHES).toHaveLength(160)
  })

  it('id 与菜名均唯一', () => {
    expect(new Set(DISHES.map((d) => d.id)).size).toBe(DISHES.length)
    expect(new Set(DISHES.map((d) => d.name)).size).toBe(DISHES.length)
  })

  it('热量落在 60–850 kcal 且为正', () => {
    for (const d of DISHES) {
      expect(d.kcal).toBeGreaterThanOrEqual(60)
      expect(d.kcal).toBeLessThanOrEqual(850)
    }
  })

  it('餐次合法且非空', () => {
    for (const d of DISHES) {
      expect(d.meals.length).toBeGreaterThan(0)
      for (const m of d.meals) expect(['b', 'l', 'd', 'm']).toContain(m)
    }
  })

  it('菜系与标签都在元数据里定义过', () => {
    const cuisineIds = CUISINES.map((c) => c.id)
    const tagIds = TAG_META.map((t) => t.id)
    for (const d of DISHES) {
      expect(d.cuisines.length).toBeGreaterThan(0)
      for (const c of d.cuisines) expect(cuisineIds).toContain(c)
      for (const t of d.tags) expect(tagIds).toContain(t)
    }
  })

  it('haystack 同时包含菜名与食材，供补录搜索', () => {
    for (const d of DISHES) {
      expect(d.haystack).toContain(d.name)
      expect(d.haystack).toContain(d.ingredients)
    }
  })

  it('难度为 1/2/3，且三档都有菜', () => {
    for (const d of DISHES) expect([1, 2, 3]).toContain(d.level)
    for (const lv of [1, 2, 3]) expect(DISHES.some((d) => d.level === lv)).toBe(true)
  })

  it('spicy 与 tags 保持一致', () => {
    for (const d of DISHES) expect(d.spicy).toBe(d.tags.includes('spicy'))
  })
})
