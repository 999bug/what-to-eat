/**
 * 自定义菜品口径：规范化、CustomDish→Dish 转换、并入抽取池、备份合并与容错。
 * 这组测试守住两条容易走样的规则：
 * 1) 自定义菜品与内置菜库**同口径**过滤，不能绕过忌口、不能无视餐次；
 * 2) 热量未知时 kcal 记 0 但 kcalKnown=false，供统计侧排除。
 */
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_ID_PREFIX,
  customToDish,
  customToDishes,
  mergeCustomDishes,
  newCustomId,
  normalizeCustom,
  parseKcal,
  readCustomDishes,
} from '@/lib/custom'
import { avoidHit, poolForMeal } from '@/lib/pool'
import type { CustomDish } from '@/types'

/** 构造一条自定义菜品，只覆盖需要的字段 */
const mk = (o: Partial<CustomDish> = {}): CustomDish => ({
  id: 'c1',
  name: '番茄炒蛋',
  icon: '🍅',
  kcal: 220,
  cuisines: ['home'],
  meals: ['l', 'd'],
  ingredients: '番茄、鸡蛋',
  tags: [],
  level: 1,
  createdAt: '2026-09-20T00:00:00.000Z',
  ...o,
})

describe('parseKcal 热量解析', () => {
  it('空值 / 非法值 / 非正数一律视为未知（null）', () => {
    expect(parseKcal('')).toBeNull()
    expect(parseKcal('   ')).toBeNull()
    expect(parseKcal(null)).toBeNull()
    expect(parseKcal(undefined)).toBeNull()
    expect(parseKcal('abc')).toBeNull()
    expect(parseKcal(0)).toBeNull()
    expect(parseKcal(-100)).toBeNull()
  })

  it('取整到 10 kcal，与内置菜库同口径', () => {
    expect(parseKcal(223)).toBe(220)
    expect(parseKcal(225)).toBe(230)
    expect(parseKcal('350')).toBe(350)
  })
})

describe('normalizeCustom 规范化', () => {
  it('只填菜名也能得到可用菜品：图标/菜系/难度/餐次全部回落到默认值', () => {
    const c = normalizeCustom({ name: '  红烧狮子头  ' })
    expect(c.name).toBe('红烧狮子头')
    expect(c.icon).toBe('🍽️')
    expect(c.cuisines).toEqual(['home'])
    expect(c.level).toBe(1)
    // 餐次为空时给全餐次，否则用户只填名字后哪都抽不到
    expect(c.meals).toEqual(['b', 'l', 'd', 'm'])
    expect(c.kcal).toBeNull()
  })

  it('菜名截断到 20 字，防止撑坏布局', () => {
    const c = normalizeCustom({ name: '一'.repeat(50) })
    expect(c.name.length).toBe(20)
  })

  it('保留用户显式填写的热量与餐次', () => {
    const c = normalizeCustom({ name: '蛋炒饭', kcal: 480, meals: ['b'], level: 2 })
    expect(c.kcal).toBe(480)
    expect(c.meals).toEqual(['b'])
    expect(c.level).toBe(2)
  })

  it('可指定 id 与 createdAt（编辑时保持稳定）', () => {
    const c = normalizeCustom({ name: 'x' }, 'cFIXED', '2026-01-01T00:00:00.000Z')
    expect(c.id).toBe('cFIXED')
    expect(c.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('newCustomId', () => {
  it('带 c 前缀，与内置菜库的 dN 不冲突', () => {
    expect(newCustomId().startsWith(CUSTOM_ID_PREFIX)).toBe(true)
  })

  it('同一毫秒连续生成也不重复', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newCustomId(1234567890)))
    expect(ids.size).toBe(200)
  })
})

describe('customToDish 转换', () => {
  it('拼出 haystack，保证补录搜索能搜到', () => {
    const d = customToDish(mk({ name: '番茄炒蛋', ingredients: '番茄、鸡蛋' }))
    expect(d.haystack).toContain('番茄炒蛋')
    expect(d.haystack).toContain('鸡蛋')
  })

  it('标记 custom=true，供「我的菜品」区分', () => {
    expect(customToDish(mk()).custom).toBe(true)
  })

  it('热量已知：kcal 照常、kcalKnown=true', () => {
    const d = customToDish(mk({ kcal: 220 }))
    expect(d.kcal).toBe(220)
    expect(d.kcalKnown).toBe(true)
  })

  it('热量未知：kcal 记 0，但 kcalKnown=false（统计侧据此排除分母）', () => {
    const d = customToDish(mk({ kcal: null }))
    expect(d.kcal).toBe(0)
    expect(d.kcalKnown).toBe(false)
  })

  it('spicy 由 tags 派生，与内置菜库同口径', () => {
    expect(customToDish(mk({ tags: ['spicy'] })).spicy).toBe(true)
    expect(customToDish(mk({ tags: [] })).spicy).toBe(false)
  })
})

describe('customToDishes 批量转换', () => {
  it('过滤掉空名字的脏数据，不污染抽取池', () => {
    const list = [mk({ id: 'c1', name: '有效菜' }), mk({ id: 'c2', name: '   ' })]
    const out = customToDishes(list)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('有效菜')
  })
})

describe('并入抽取池（与内置菜库同口径）', () => {
  const custom = mk({ id: 'cTEST', name: '番茄炒蛋', meals: ['l'], cuisines: ['home'] })

  it('自定义菜品能进候选池，且内置菜库不受影响', () => {
    const base = poolForMeal('l', [], [], []).length
    const withCustom = poolForMeal('l', [], [], [], [], [customToDish(custom)]).length
    expect(withCustom).toBe(base + 1)
  })

  it('餐次不符时不进入候选池', () => {
    const breakfastOnly = mk({ id: 'cB', name: '豆浆', meals: ['b'] })
    const pool = poolForMeal('l', [], [], [], [], [customToDish(breakfastOnly)])
    expect(pool.some((d) => d.id === 'cB')).toBe(false)
  })

  it('菜系筛选对自定义菜品同样生效', () => {
    const pool = poolForMeal('l', ['chuan'], [], [], [], [customToDish(custom)])
    expect(pool.some((d) => d.id === 'cTEST')).toBe(false)
  })

  it('难度筛选对自定义菜品同样生效', () => {
    const easy = mk({ id: 'cE', name: '凉拌黄瓜', meals: ['l'], level: 1 })
    const pool = poolForMeal('l', [], [], [], [3], [customToDish(easy)])
    expect(pool.some((d) => d.id === 'cE')).toBe(false)
  })

  it('忌口是硬过滤：自定义菜品也不能绕过', () => {
    // 自定义一道含牛肉的菜，开启「牛羊肉」忌口（关键字命中的是「牛」）
    const beef = mk({ id: 'cBEEF', name: '土豆炖牛肉', ingredients: '土豆、牛肉', meals: ['l'] })
    const dish = customToDish(beef)
    expect(avoidHit(dish, ['mutton'])).toBe(true)
    const pool = poolForMeal('l', [], [], ['mutton'], [], [dish])
    expect(pool.some((d) => d.id === 'cBEEF')).toBe(false)
  })

  it('辣忌口通过 tag 命中自定义菜品', () => {
    const spicy = mk({ id: 'cSPICY', name: '水煮肉片', tags: ['spicy'], meals: ['l'] })
    const dish = customToDish(spicy)
    expect(avoidHit(dish, ['spicy'])).toBe(true)
    const pool = poolForMeal('l', [], [], ['spicy'], [], [dish])
    expect(pool.some((d) => d.id === 'cSPICY')).toBe(false)
  })
})

describe('mergeCustomDishes 备份合并', () => {
  it('按「菜名 + 热量」去重，同名同热量不重复导入', () => {
    const local = [mk({ id: 'c1', name: '蛋炒饭', kcal: 480 })]
    const incoming = [mk({ id: 'c9', name: '蛋炒饭', kcal: 480 })]
    expect(mergeCustomDishes(local, incoming)).toHaveLength(1)
  })

  it('同名但热量不同视为不同菜品（用户可能改过热量）', () => {
    const local = [mk({ id: 'c1', name: '蛋炒饭', kcal: 480 })]
    const incoming = [mk({ id: 'c9', name: '蛋炒饭', kcal: 520 })]
    expect(mergeCustomDishes(local, incoming)).toHaveLength(2)
  })

  it('冲突时保留本地版本（本地优先）', () => {
    const local = [mk({ id: 'cLOCAL', name: '蛋炒饭', kcal: 480 })]
    const incoming = [mk({ id: 'cREMOTE', name: '蛋炒饭', kcal: 480 })]
    const out = mergeCustomDishes(local, incoming)
    expect(out[0].id).toBe('cLOCAL')
  })

  it('保留本地已有 + 追加新的', () => {
    const local = [mk({ id: 'c1', name: 'A' })]
    const incoming = [mk({ id: 'c2', name: 'B' })]
    const out = mergeCustomDishes(local, incoming)
    expect(out.map((c) => c.name)).toEqual(['A', 'B'])
  })

  it('忽略空名字的脏数据', () => {
    const out = mergeCustomDishes([], [mk({ id: 'c1', name: '' }), mk({ id: 'c2', name: 'ok' })])
    expect(out).toHaveLength(1)
  })
})

describe('readCustomDishes 旧备份容错', () => {
  it('非数组一律返回空数组（旧备份没有这个字段）', () => {
    expect(readCustomDishes(undefined)).toEqual([])
    expect(readCustomDishes(null)).toEqual([])
    expect(readCustomDishes('nope')).toEqual([])
    expect(readCustomDishes({})).toEqual([])
  })

  it('过滤掉没有 name 的条目', () => {
    const out = readCustomDishes([{ id: 'c1' }, { id: 'c2', name: 'ok' }, null])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('ok')
  })
})
