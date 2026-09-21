/**
 * 自定义菜品的规范化与持久化口径。
 *
 * 为什么单独放一个 lib 而不是塞进 store：
 * - CustomDish（用户填的、字段可空）→ Dish（抽取池要的、字段必填）的转换是有规则的纯函数，
 *   既要在 store 里用，也要在测试里单测，放 lib 才能被两边共享。
 * - 去重合并、校验、id 生成都属于「口径」，散在组件里必然走样。
 */
import type { CustomDish, Dish, DishLevel, MealId } from '@/types'

/** 自定义菜品 id 前缀，保证与内置菜库的 dN 永不冲突 */
export const CUSTOM_ID_PREFIX = 'c'

/** 默认值：让「只填菜名」也能立刻可用 */
export const CUSTOM_DEFAULTS = {
  icon: '🍽️',
  /** 自定义菜默认归入独立分类「我的菜品」，不再混进家常菜 */
  cuisine: 'my',
  level: 1 as DishLevel,
  ingredients: '',
} as const

/** 菜名上限，防止把整段话塞进菜名破坏布局 */
export const NAME_MAX = 20

/**
 * 生成自定义菜品 id。
 *
 * 用「时间戳 + 进程内单调计数 + 随机串」三段拼：
 * - 只有时间戳 + 小随机串时，同一毫秒内批量添加会撞 id（实测 200 次撞 9 次）；
 * - 单调计数保证同毫秒内唯一，随机串保证跨会话/跨设备也不易撞。
 */
let seq = 0

export function newCustomId(seed = Date.now()): string {
  seq = (seq + 1) % 0xffff
  const rand = Math.floor(Math.random() * 0xffffff).toString(36)
  return `${CUSTOM_ID_PREFIX}${seed.toString(36)}${seq.toString(36)}${rand}`
}

/** 热量输入解析：空 / 非法 / ≤0 一律视为「未知」，返回 null */
export function parseKcal(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string' && raw.trim() === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // 与内置菜库一致：取整到 10 kcal
  return Math.round(n / 10) * 10
}

/** 规范化用户输入（菜名去空白并截断；空数组回落到默认值） */
export function normalizeCustom(
  input: {
    name: string
    icon?: string
    kcal?: number | null
    cuisines?: string[]
    meals?: MealId[]
    ingredients?: string
    tags?: string[]
    level?: DishLevel
  },
  id = newCustomId(),
  createdAt = new Date().toISOString(),
): CustomDish {
  const name = input.name.trim().slice(0, NAME_MAX)
  const cuisines = input.cuisines?.filter(Boolean) ?? []
  const meals = input.meals?.filter(Boolean) ?? []
  return {
    id,
    name,
    icon: input.icon?.trim() || CUSTOM_DEFAULTS.icon,
    kcal: input.kcal ?? null,
    cuisines: cuisines.length > 0 ? cuisines : [CUSTOM_DEFAULTS.cuisine],
    // 餐次为空时按「全餐次」处理，避免用户只填菜名后哪都抽不到
    meals: meals.length > 0 ? meals : (['b', 'l', 'd', 'm'] as MealId[]),
    ingredients: (input.ingredients ?? '').trim(),
    tags: input.tags ?? [],
    level: input.level ?? CUSTOM_DEFAULTS.level,
    createdAt,
  }
}

/**
 * CustomDish → Dish（抽取池唯一入口）。
 *
 * 关键口径：
 * - 热量未知时 `kcal` 记 **0**，同时 `kcalKnown=false`；
 *   统计侧据此把这条排除在日均分母之外（见 lib/stats.ts），避免把未知当 0 拉低均值。
 * - `haystack` 必须拼好，否则补录搜索搜不到自定义菜。
 * - `spicy` 由 tags 派生，与内置菜库同口径。
 */
export function customToDish(c: CustomDish): Dish {
  const kcalKnown = c.kcal !== null
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    kcal: kcalKnown ? (c.kcal as number) : 0,
    cuisines: c.cuisines,
    meals: c.meals,
    ingredients: c.ingredients,
    tags: c.tags,
    level: c.level,
    spicy: c.tags.includes('spicy'),
    haystack: `${c.name} ${c.ingredients}`.trim(),
    kcalKnown,
    custom: true,
  }
}

/** 批量转换（过滤掉空名字的脏数据，避免污染抽取池） */
export function customToDishes(list: CustomDish[]): Dish[] {
  return list.filter((c) => c.name.trim() !== '').map(customToDish)
}

/**
 * 合并两批自定义菜品（导入备份时用）。
 * 去重键 = 菜名 + 热量：同名同热量视为同一道菜，避免重复导入后菜库翻倍。
 * 冲突时保留已有的（本地优先），因为用户可能刚改过。
 */
export function mergeCustomDishes(current: CustomDish[], incoming: CustomDish[]): CustomDish[] {
  const key = (c: CustomDish) => `${c.name.trim()}::${c.kcal ?? 'unknown'}`
  const seen = new Set(current.map(key))
  const out = [...current]
  for (const c of incoming) {
    if (!c || typeof c.name !== 'string' || c.name.trim() === '') continue
    const k = key(c)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

/** 旧备份可能没有 customDishes 字段：容错读取 */
export function readCustomDishes(raw: unknown): CustomDish[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (c): c is CustomDish =>
      !!c && typeof c === 'object' && typeof (c as CustomDish).name === 'string',
  )
}

/**
 * 旧数据迁移：自定义菜从「默认归家常菜」改为「独立分类我的菜品」。
 *
 * 只迁移**仍停留在旧默认值**的菜（cuisines 恰为 ['home'] 或为空）；
 * 用户当时显式选过川菜/粤菜等的保持原样，不越权重打标签。
 * 在 store 初始化时执行一次，之后的保存自然落新默认值。
 */
export function migrateCustomDishes(list: CustomDish[]): CustomDish[] {
  let touched = false
  const out = list.map((c) => {
    const isOldDefault = c.cuisines.length === 0 || (c.cuisines.length === 1 && c.cuisines[0] === 'home')
    if (!isOldDefault) return c
    touched = true
    return { ...c, cuisines: [CUSTOM_DEFAULTS.cuisine] }
  })
  // 没动过就不返回新引用，避免无谓的 state 变更
  return touched ? out : list
}
