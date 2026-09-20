/**
 * 抽取口径（唯一来源）：
 * - 候选池 = 菜库 ∩ 餐次 ∩ 菜系筛选 ∩ 口味筛选 − 忌口
 * - 权重：7 天内吃过 ×0.3（软降权，不硬排除）；收藏 ×1.5
 * - 加权随机抽取；转盘候选固定 8 个
 */
import { DISHES } from '@/data/dishes'
import { AVOID_META } from '@/data/meta'
import type { Dish, DishLevel, MealId, MealRecord } from '@/types'
import { daysBetween, todayStr } from '@/lib/date'

/** 忌口命中判定（菜名 + 食材关键词 / 辣标签） */
export function avoidHit(d: Dish, avoid: string[]): boolean {
  if (avoid.length === 0) return false
  const text = d.name + d.ingredients
  return avoid.some((id) => {
    const meta = AVOID_META.find((a) => a.id === id)
    if (!meta) return false
    if (meta.tag && d.tags.includes(meta.tag)) return true
    return meta.kw.some((w) => text.includes(w))
  })
}

/**
 * 按餐次与筛选条件构建候选池（levels 为空表示不限难度）。
 *
 * `extra` 用于把用户自定义菜品并入候选池——它们与内置菜库走**完全相同**的
 * 餐次 / 菜系 / 口味 / 难度 / 忌口过滤，不享受任何特权，也不能绕过忌口。
 */
export function poolForMeal(
  meal: MealId,
  filterCuisines: string[],
  filterTags: string[],
  avoid: string[],
  filterLevels: DishLevel[] = [],
  extra: Dish[] = [],
): Dish[] {
  const source = extra.length > 0 ? [...DISHES, ...extra] : DISHES
  return source.filter((d) => {
    if (!d.meals.includes(meal)) return false
    if (filterCuisines.length > 0 && !d.cuisines.some((c) => filterCuisines.includes(c))) return false
    if (filterTags.length > 0 && !filterTags.some((t) => d.tags.includes(t))) return false
    if (filterLevels.length > 0 && !filterLevels.includes(d.level)) return false
    return !avoidHit(d, avoid)
  })
}

/** 单菜抽取权重 */
export function weightFor(
  d: Dish,
  records: MealRecord[],
  favorites: string[],
  dedupe: boolean,
): number {
  let w = 1
  if (dedupe) {
    const today = todayStr()
    const recent = records.some((r) => r.dishId === d.id && daysBetween(r.date, today) <= 7)
    if (recent) w *= 0.3
  }
  if (favorites.includes(d.id)) w *= 1.5
  return w
}

/** 加权随机抽一个；excludeIds 里的菜不参与（池被排空时回退为全池） */
export function pickWeighted(
  pool: Dish[],
  records: MealRecord[],
  favorites: string[],
  dedupe: boolean,
  excludeIds: string[] = [],
): Dish | null {
  let items = pool.filter((d) => !excludeIds.includes(d.id))
  if (items.length === 0) items = pool
  if (items.length === 0) return null

  const weights = items.map((d) => weightFor(d, records, favorites, dedupe))
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** 抽转盘候选（最多 8 个，互不重复） */
export function pickCandidates(
  pool: Dish[],
  records: MealRecord[],
  favorites: string[],
  dedupe: boolean,
  count = 8,
): Dish[] {
  const used: string[] = []
  const out: Dish[] = []
  let guard = 0
  while (out.length < count && guard++ < 300) {
    const d = pickWeighted(pool, records, favorites, dedupe, used)
    if (!d) break
    used.push(d.id)
    out.push(d)
    if (pool.length <= out.length) break
  }
  return out
}
