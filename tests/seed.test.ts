/** 示例数据：固定种子 → 确定性输出，且全部落在合法日期与菜库范围内 */
import { describe, expect, it } from 'vitest'
import { mulberry32, seedRecords } from '@/data/seed'
import { DISHES } from '@/data/dishes'
import { todayStr, ymd } from '@/lib/date'

describe('mulberry32', () => {
  it('同种子输出完全一致，且落在 [0,1)', () => {
    const a = mulberry32(20260920)
    const b = mulberry32(20260920)
    for (let i = 0; i < 50; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('seedRecords', () => {
  const rs = seedRecords()

  it('两次生成完全相同（跨面板数字自洽的前提）', () => {
    expect(seedRecords()).toEqual(rs)
  })

  it('记录非空，且只落在今天及之前', () => {
    expect(rs.length).toBeGreaterThan(0)
    const today = todayStr()
    for (const r of rs) expect(r.date <= today).toBe(true)
  })

  it('菜品均来自内置菜库，热量 = 菜库 kcal × 份量', () => {
    for (const r of rs) {
      const d = DISHES.find((x) => x.id === r.dishId)
      expect(d).toBeDefined()
      expect(r.kcal).toBe(Math.round(d!.kcal * r.servings))
      expect(r.cuisine).toBe(d!.cuisines[0])
    }
  })

  it('id 唯一', () => {
    expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length)
  })

  it('今天的记录存在（首次进入不空白）', () => {
    expect(rs.some((r) => r.date === ymd(new Date()))).toBe(true)
  })
})
