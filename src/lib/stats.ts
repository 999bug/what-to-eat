/**
 * 统计口径（唯一来源）：月统计、日热量、菜系分布、连续天数。
 * 禁止在组件里各自 reduce——所有展示数字必须出自这里，保证跨面板自洽。
 */
import type { MealId, MealRecord } from '@/types'
import { daysInMonth, pad, todayStr } from '@/lib/date'

export interface CuisineCount {
  id: string
  n: number
}

export interface MonthStat {
  /** 当月天数 */
  dim: number
  /** 已记录天数 */
  days: number
  /**
   * 日均热量。
   * 口径：只统计**已知热量**的记录，分母也只数「至少有 1 条已知热量记录」的天数——
   * 用户手动录入的菜若不填热量（kcalKnown=false），不应当作 0 把日均拉低。
   */
  avg: number
  /** 当月总热量（只加已知热量的记录） */
  total: number
  /** 三餐覆盖率（已记餐次数 / 已记天数 × 餐位数） */
  cover: number
  /** 连续记录天数（截至今天往前数） */
  streak: number
  /** 菜系分布（按次数倒序） */
  cuisines: CuisineCount[]
  /** 每日热量数组（下标 0 = 1 号） */
  daily: number[]
  /**
   * 当月含有「热量未知」记录的天数。
   * > 0 时界面必须提示用户「有 N 天热量不完整」，否则日均会被误读成真实值。
   */
  unknownDays: number
  /** 当月热量未知的记录条数 */
  unknownCount: number
}

/** 该条记录的热量是否已知（老数据没有该字段，视为已知） */
export function isKcalKnown(r: MealRecord): boolean {
  return r.kcalKnown !== false
}

/** 某天的全部记录（meals 传入时只取指定餐次） */
export function recordsOn(records: MealRecord[], date: string, meals?: MealId[]): MealRecord[] {
  return records.filter((r) => r.date === date && (!meals || meals.includes(r.meal)))
}

/**
 * 某天的热量合计（meals 传入时只统计指定餐次）。
 * 口径：热量未知的记录按 0 计入合计（合计无法表达「未知」），
 * 但调用方要知道该天是否完整，请同时用 unknownCountOn 判断。
 */
export function dayKcal(records: MealRecord[], date: string, meals?: MealId[]): number {
  return recordsOn(records, date, meals).reduce((s, r) => s + r.kcal, 0)
}

/** 某天热量未知的记录条数（>0 表示当天热量不完整） */
export function unknownCountOn(records: MealRecord[], date: string, meals?: MealId[]): number {
  return recordsOn(records, date, meals).filter((r) => !isKcalKnown(r)).length
}

/** 当前启用的餐次列表（夜宵开关影响） */
export function activeMeals(midnight: boolean): MealId[] {
  return midnight ? ['b', 'l', 'd', 'm'] : ['b', 'l', 'd']
}

/**
 * 当月记录（并按夜宵开关过滤餐次）。
 * 口径：夜宵关闭时，已存的夜宵记录在所有面板都不参与统计，但数据仍保留。
 */
export function monthRecords(records: MealRecord[], ym: string, midnight: boolean): MealRecord[] {
  const meals = activeMeals(midnight)
  return records.filter((r) => r.date.slice(0, 7) === ym && meals.includes(r.meal))
}

/** 月统计（records 只需传入，函数内按月过滤） */
export function monthStat(records: MealRecord[], ym: string, midnight: boolean): MonthStat {
  const meals = activeMeals(midnight)
  const rs = monthRecords(records, ym, midnight)

  // 热量：只累加已知值；未知记录 kcal 虽然是 0，但必须在分母口径上被区分开
  const kcalByDate = new Map<string, number>()
  const unknownByDate = new Map<string, number>()
  for (const r of rs) {
    if (isKcalKnown(r)) {
      kcalByDate.set(r.date, (kcalByDate.get(r.date) ?? 0) + r.kcal)
    } else {
      unknownByDate.set(r.date, (unknownByDate.get(r.date) ?? 0) + 1)
    }
  }

  // 「已记录天数」= 有任何记录的天（含只有未知热量的天），覆盖率与连续天数用这个口径
  const byDate = new Map<string, number>()
  for (const r of rs) byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1)
  const dates = [...byDate.keys()]

  // 日均：分子是已知热量合计，分母是**有已知热量记录的天数**
  // （若某天全是未知热量，该天不进分母，否则等于把未知当 0 拉低均值）
  const total = [...kcalByDate.values()].reduce((s, v) => s + v, 0)
  const kcalDays = kcalByDate.size

  const counts = new Map<string, number>()
  for (const r of rs) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1)
  const cuisines = [...counts.entries()]
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n)

  // 三餐覆盖率：已记的「天 × 餐次」组合数 / 已记天数 × 启用餐位数
  const mealsByDate = new Map<string, Set<MealId>>()
  for (const r of rs) {
    const set = mealsByDate.get(r.date) ?? new Set<MealId>()
    set.add(r.meal)
    mealsByDate.set(r.date, set)
  }
  const slots = mealsByDate.size * meals.length
  const covered = [...mealsByDate.values()].reduce((s, set) => s + set.size, 0)

  // 连续记录天数：从今天往前数，断档即停
  let streak = 0
  let cur = todayStr()
  const today = cur
  while (recordsOn(records, cur, meals).length > 0) {
    streak++
    const d = new Date(cur + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const [y, m, dd] = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    cur = `${y}-${pad(m)}-${pad(dd)}`
    if (cur === today && streak > 4000) break
  }

  const dim = daysInMonth(ym)
  const daily = Array.from({ length: dim }, (_, i) => kcalByDate.get(`${ym}-${pad(i + 1)}`) ?? 0)

  return {
    dim,
    days: dates.length,
    avg: kcalDays > 0 ? Math.round(total / kcalDays) : 0,
    total,
    cover: slots > 0 ? Math.round((covered / slots) * 100) : 0,
    streak,
    cuisines,
    daily,
    unknownDays: unknownByDate.size,
    unknownCount: [...unknownByDate.values()].reduce((s, v) => s + v, 0),
  }
}
