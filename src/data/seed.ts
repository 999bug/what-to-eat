/**
 * 确定性示例数据：mulberry32 固定种子，保证每次生成的记录一致，
 * 日历 / 统计 / 热量三处数字天然自洽。仅首次进入（无本地记录）时写入。
 */
import type { Dish, MealId, MealRecord } from '@/types'
import { DISHES } from '@/data/dishes'
import { ymd } from '@/lib/date'

/** mulberry32 PRNG（固定种子 → 确定性输出） */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function poolFor(meal: MealId): Dish[] {
  return DISHES.filter((d) => d.meals.includes(meal))
}

/** 生成当月 1 号到昨天 + 今天早餐的示例记录 */
export function seedRecords(): MealRecord[] {
  const rnd = mulberry32(20260920)
  const out: MealRecord[] = []
  const now = new Date()
  const today = now.getDate()

  const add = (date: string, meal: MealId, dish: Dish) => {
    const servings = rnd() < 0.25 ? 1.5 : 1
    out.push({
      id: 'r' + (out.length + 1),
      date,
      meal,
      dishId: dish.id,
      dishName: dish.name,
      icon: dish.icon,
      cuisine: dish.cuisines[0],
      servings,
      kcal: Math.round(dish.kcal * servings),
      source: 'seed',
      createdAt: date + 'T12:00:00',
    })
  }

  for (let day = 1; day < today; day++) {
    if (rnd() > 0.62) continue
    const date = ymd(new Date(now.getFullYear(), now.getMonth(), day))
    const bp = poolFor('b')
    const lp = poolFor('l')
    const dp = poolFor('d')
    const mp = poolFor('m')
    if (rnd() < 0.55) add(date, 'b', bp[Math.floor(rnd() * bp.length)])
    add(date, 'l', lp[Math.floor(rnd() * lp.length)])
    if (rnd() < 0.78) add(date, 'd', dp[Math.floor(rnd() * dp.length)])
    if (rnd() < 0.16) add(date, 'm', mp[Math.floor(rnd() * mp.length)])
  }

  // 今天已记早餐，午餐/晚餐留给用户自己抽
  const td = ymd(now)
  const bp = poolFor('b')
  add(td, 'b', bp[Math.floor(rnd() * bp.length)])

  return out
}
