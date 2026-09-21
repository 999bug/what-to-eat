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

/**
 * 生成示例记录：覆盖「本月 1 号 ~ 今天」，并按自然周保证每周至少 3 天有记录，
 * 这样日历一进来就是满的，不会出现整月空白（用户抱怨过「日历默认都是空的」）。
 * 今天同样给出一日三餐示例，用户抽签后只需覆盖对应餐次。
 */
export function seedRecords(): MealRecord[] {
  const rnd = mulberry32(20260925)
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

  // 先按周排好「本周活跃日」，保证任意 7 天窗口内都不会整周空白。
  // 今天单独处理（见下方），所以循环只到昨天，避免今天被记两遍。
  for (let day = 1; day < today; day++) {
    const date = ymd(new Date(now.getFullYear(), now.getMonth(), day))
    // 周一到周日 7 天里至少 3 天有记录（周末更容易有）
    const weekSlot = (day - 1) % 7
    const active =
      weekSlot === 2 || // 周三
      weekSlot === 5 || // 周六
      weekSlot === 6 || // 周日
      rnd() < 0.45

    if (!active) continue

    const bp = poolFor('b')
    const lp = poolFor('l')
    const dp = poolFor('d')
    const mp = poolFor('m')
    // 早餐常被跳过，午餐几乎必记，晚餐多数会记，夜宵偶尔
    if (rnd() < 0.62) add(date, 'b', bp[Math.floor(rnd() * bp.length)])
    add(date, 'l', lp[Math.floor(rnd() * lp.length)])
    if (rnd() < 0.85) add(date, 'd', dp[Math.floor(rnd() * dp.length)])
    if (rnd() < 0.16) add(date, 'm', mp[Math.floor(rnd() * mp.length)])
  }

  // 今天补齐三餐作为示例（抽签/补录后由用户自己的记录覆盖）
  const td = ymd(now)
  const bp = poolFor('b')
  const lp = poolFor('l')
  const dp = poolFor('d')
  add(td, 'b', bp[Math.floor(rnd() * bp.length)])
  add(td, 'l', lp[Math.floor(rnd() * lp.length)])
  add(td, 'd', dp[Math.floor(rnd() * dp.length)])

  return out
}
