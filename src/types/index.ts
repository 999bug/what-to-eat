/** 领域模型：全项目唯一的跨层契约，单位与口径见各字段注释 */

/** 餐次：b 早餐 / l 午餐 / d 晚餐 / m 夜宵 */
export type MealId = 'b' | 'l' | 'd' | 'm'

/** 主视图：抽签 / 日历 / 统计 / 设置 */
export type ViewId = 'draw' | 'calendar' | 'stats' | 'settings'

/** 做菜难度：1 简单（一步到位）/ 2 中等（需腌制调汁或多步）/ 3 有点难（炖煮油炸包制烤制） */
export type DishLevel = 1 | 2 | 3

/** 抽取玩法 */
export type DrawMode = 'wheel' | 'lots'

/** 记录来源：draw 抽签 / manual 补录 / relog 再吃一次 / seed 示例数据 */
export type RecordSource = 'draw' | 'manual' | 'relog' | 'seed'

/** 菜品（内置菜库，静态只读） */
export interface Dish {
  /** 唯一标识（如 d1） */
  id: string
  name: string
  /** emoji 图标（不外链图片） */
  icon: string
  /** 单人标准份热量，估算值，取整到 10 kcal */
  kcal: number
  /** 菜系标签，可多值（如 ['chuan', 'home']） */
  cuisines: string[]
  /** 适用餐次 */
  meals: MealId[]
  /** 主要食材（仅展示，无做法） */
  ingredients: string
  /** 口味与场景标签（spicy / quick / xiafan…） */
  tags: string[]
  /** 做菜难度 1/2/3 */
  level: DishLevel
  /** 是否辣（由 tags 派生） */
  spicy: boolean
  /** 菜名 + 食材拼接，供补录搜索 */
  haystack: string
}

/** 一条用餐记录（一份菜 × 一次餐次） */
export interface MealRecord {
  id: string
  /** 本地日期 YYYY-MM-DD */
  date: string
  meal: MealId
  dishId: string
  dishName: string
  icon: string
  /** 主菜系（取 cuisines[0]），用于统计 */
  cuisine: string
  /** 份量系数（1 = 标准份） */
  servings: number
  /** 估算热量 = 菜品 kcal × servings，取整 */
  kcal: number
  source: RecordSource
  createdAt: string
}

/** 用户设置（localStorage 持久化） */
export interface Settings {
  /** 主题：light 浅色（默认）/ dark 深色 / auto 跟随系统 */
  theme: 'light' | 'dark' | 'auto'
  /** 显示夜宵（默认关闭） */
  midnight: boolean
  /** 默认份量系数 */
  serving: number
  /** 启用每日热量目标 */
  goalOn: boolean
  /** 每日目标 kcal（估算口径） */
  goal: number
  /** 忌口黑名单（AVOID_META 的 id，硬过滤） */
  avoid: string[]
  /** 智能去重：7 天内吃过的菜降权 */
  dedupe: boolean
  /** 抽取玩法 */
  mode: DrawMode
}

/** 抽签筛选条件（会话级，不持久化；忌口在 settings 里长期生效） */
export interface Filters {
  cuisines: string[]
  tags: string[]
  /** 难度筛选（1/2/3，空为不限） */
  levels: DishLevel[]
}
