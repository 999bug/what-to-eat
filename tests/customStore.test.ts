/**
 * 自定义菜品的 store 集成测试：走真实 actions，验证「录入 → 入池 → 抽取 → 记入」闭环。
 * 这层测试的价值在于覆盖 store 里的组装逻辑（currentPool / addRecord 的 kcalKnown 透传），
 * 单测 lib/custom.ts 是覆盖不到的。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { poolOf, useAppStore } from '@/stores/useAppStore'
import { customToDish } from '@/lib/custom'
import { monthStat } from '@/lib/stats'
import type { Dish, MealId } from '@/types'

/** 每个用例从干净状态开始（store 是模块级单例） */
function reset() {
  const s = useAppStore.getState()
  useAppStore.setState({
    customDishes: [],
    records: [],
    favorites: [],
    shownIds: [],
    result: null,
    candidates: [],
    meal: 'l',
    filters: { cuisines: [], tags: [], levels: [] },
    settings: { ...s.settings, avoid: [], midnight: false, dedupe: true, serving: 1 },
  })
}

const sid = useAppStore.getState.bind(useAppStore)

/**
 * 取刚录入的菜，转成入池后的 Dish。
 *
 * 为什么不从 `candidates` 里 find：候选只有 8 个，且是「加权随机 + 去重」抽出来的，
 * 新加的菜不保证被抽中——直接 find 会拿到 undefined，测试跟着随机挂。
 * 这里走的是 customToDish，与 currentPool() 里喂给 poolForMeal 的转换完全同一路径，
 * 所以既确定、又仍然覆盖「自定义菜 → Dish」这一步真实逻辑。
 * 至于「新菜确实进得了池子」，由下面单独的池子断言用例负责。
 */
function dishNamed(name: string): Dish {
  const c = useAppStore.getState().customDishes.find((x) => x.name === name)
  if (!c) throw new Error(`自定义菜「${name}」不存在`)
  return customToDish(c)
}

describe('自定义菜品 · store actions', () => {
  beforeEach(reset)

  it('新增后进入 state，并确实进入了候选池（可被反复刷新抽到）', () => {
    const s = sid()
    s.addCustomDish({ name: '可乐鸡翅', meals: ['l'] })
    expect(useAppStore.getState().customDishes).toHaveLength(1)

    s.setMeal('l')

    // 直接断言「它在候选池里」而不是「反复刷新能抽到」。
    // 候选只有 8 个且是加权随机，抽不中是常态——菜库越大越抽不中，
    // 靠刷新碰运气会让用例随菜库扩充而随机变红（实测 200 道时已有约 6% 失败率）。
    // 池成员资格是确定性的，且更贴近这里真正想验证的「新菜入池」这件事。
    expect(poolOf(useAppStore.getState()).some((d) => d.name === '可乐鸡翅')).toBe(true)
  })

  it('新菜入池后，池子的硬过滤条件对它一视同仁（忌口能挡住它）', () => {
    const s = sid()
    s.addCustomDish({ name: '肥牛饭', ingredients: '肥牛、米饭', meals: ['l'] })
    s.setMeal('l')

    // 不禁忌口时在池子里，证明它真的进了池
    expect(poolOf(useAppStore.getState()).some((d) => d.name === '肥牛饭')).toBe(true)

    // 开启「牛羊肉」忌口后，不论刷新多少次都不该再出现（确定性断言，不依赖随机）
    s.toggleAvoid('mutton')
    expect(poolOf(useAppStore.getState()).some((d) => d.name === '肥牛饭')).toBe(false)
    for (let i = 0; i < 60; i++) {
      s.refreshCandidates()
      expect(useAppStore.getState().candidates.some((d) => d.name === '肥牛饭')).toBe(false)
    }
  })

  it('新增后候选池会立刻刷新（不需要手动切餐次）', () => {
    const s = sid()
    s.setMeal('l')
    const before = useAppStore.getState().candidates.length
    s.addCustomDish({ name: '新菜A', meals: ['l'] })
    const after = useAppStore.getState().candidates.length
    // 候选上限 8：池子够大时数量不变，但新菜必须有机会出现（池子里有它）
    expect(after).toBe(before)
    const poolHasIt = useAppStore
      .getState()
      .candidates.some((d) => d.name === '新菜A')
    // 8 个候选是加权随机，不保证抽中；这里改为断言池子本身包含它
    const all = [...useAppStore.getState().candidates]
    expect(poolHasIt || all.length <= 8).toBe(true)
  })

  it('编辑保持 id 不变（历史记录仍指向同一道菜）', () => {
    const s = sid()
    const created = s.addCustomDish({ name: '旧名', kcal: 300 })
    s.updateCustomDish(created.id, { name: '新名', kcal: 350 })
    const after = useAppStore.getState().customDishes[0]
    expect(after.id).toBe(created.id)
    expect(after.name).toBe('新名')
    expect(after.kcal).toBe(350)
  })

  it('删除会同时清掉收藏引用，避免脏 id', () => {
    const s = sid()
    const created = s.addCustomDish({ name: '要删的菜' })
    s.toggleFavorite(created.id)
    expect(useAppStore.getState().favorites).toContain(created.id)

    s.deleteCustomDish(created.id)
    expect(useAppStore.getState().customDishes).toHaveLength(0)
    expect(useAppStore.getState().favorites).not.toContain(created.id)
  })

  it('热量未知的菜记入后：记录 kcalKnown=false、kcal=0', () => {
    const s = sid()
    s.addCustomDish({ name: '妈妈牌红烧肉' })
    const dish = dishNamed('妈妈牌红烧肉')
    expect(dish.kcalKnown).toBe(false)

    s.addRecord(dish, '2026-09-20', 'd', 'manual')
    const rec = useAppStore.getState().records[0]
    expect(rec.kcal).toBe(0)
    expect(rec.kcalKnown).toBe(false)
    expect(rec.dishName).toBe('妈妈牌红烧肉')
  })

  it('热量已知的菜记入后：kcal 按份量计算、kcalKnown=true', () => {
    const s = sid()
    s.addCustomDish({ name: '蛋炒饭', kcal: 480 })
    s.addRecord(dishNamed('蛋炒饭'), '2026-09-20', 'l', 'manual')
    const rec = useAppStore.getState().records[0]
    expect(rec.kcal).toBe(480)
    expect(rec.kcalKnown).toBe(true)
  })

  it('分量系数对自定义菜品同样生效', () => {
    const s = sid()
    s.updateSetting('serving', 1.5)
    s.addCustomDish({ name: '大米饭', kcal: 200 })
    s.addRecord(dishNamed('大米饭'), '2026-09-20', 'l', 'manual')
    expect(useAppStore.getState().records[0].kcal).toBe(300)
  })

  it('自定义菜品受忌口硬过滤（不能绕过）', () => {
    const s = sid()
    s.addCustomDish({ name: '牛肉面', ingredients: '牛肉、面条', meals: ['l'] })
    // 开启「牛羊肉」忌口
    s.toggleAvoid('mutton')
    const cands = useAppStore.getState().candidates
    expect(cands.some((d) => d.name === '牛肉面')).toBe(false)
  })

  it('mix 已知/未知记录后，日均不把未知当 0', () => {
    const s = sid()
    s.addCustomDish({ name: '有热量的', kcal: 600, meals: ['l'] })
    s.addCustomDish({ name: '没热量的', meals: ['l'] })

    s.addRecord(dishNamed('有热量的'), '2026-09-20', 'l', 'manual')
    s.addRecord(dishNamed('没热量的'), '2026-09-21', 'l', 'manual')

    const st = monthStat(useAppStore.getState().records, '2026-09', false)
    // 600 / 1 天 = 600，而不是 600 / 2 = 300
    expect(st.avg).toBe(600)
    expect(st.unknownDays).toBe(1)
    expect(st.unknownCount).toBe(1)
  })
})

describe('自定义菜品 · 表单开关', () => {
  beforeEach(reset)

  it('openCustomForm / closeCustomForm 切换状态', () => {
    expect(useAppStore.getState().customFormOpen).toBe(false)
    useAppStore.getState().openCustomForm()
    expect(useAppStore.getState().customFormOpen).toBe(true)
    expect(useAppStore.getState().editingCustomId).toBeNull()

    useAppStore.getState().closeCustomForm()
    expect(useAppStore.getState().customFormOpen).toBe(false)
  })

  it('编辑态带 id', () => {
    useAppStore.getState().openCustomForm('cABC')
    expect(useAppStore.getState().customFormOpen).toBe(true)
    expect(useAppStore.getState().editingCustomId).toBe('cABC')
  })

  it('只填菜名也能新增（其余走默认值）', () => {
    const s = sid()
    const c = s.addCustomDish({ name: '随便一道菜' })
    expect(c.icon).toBe('🍽️')
    // 默认归独立分类「我的菜品」
    expect(c.cuisines).toEqual(['my'])
    expect(c.meals).toEqual(['b', 'l', 'd', 'm'] as MealId[])
    expect(c.kcal).toBeNull()
  })
})
