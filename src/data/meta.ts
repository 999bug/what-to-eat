/** 菜库元数据：餐次、菜系、口味标签、忌口（静态只读） */
import type { DishLevel, MealId } from '@/types'

export interface MealMeta {
  id: MealId
  name: string
}

export interface CuisineMeta {
  id: string
  name: string
}

export interface TagMeta {
  id: string
  name: string
  /** 可选说明（如快手 = 15 分钟内） */
  desc?: string
}

export interface LevelMeta {
  id: DishLevel
  name: string
  desc: string
}

export const LEVEL_META: readonly LevelMeta[] = [
  { id: 1, name: '简单', desc: '洗切下锅，10~15 分钟' },
  { id: 2, name: '中等', desc: '要腌要调汁，20~40 分钟' },
  { id: 3, name: '有点难', desc: '炖煮/油炸/包制，留足时间' },
]

export interface AvoidMeta {
  id: string
  name: string
  /** 食材/菜名关键词（命中即过滤） */
  kw: string[]
  /** 标签型忌口（如辣 → tags 含 spicy） */
  tag?: string
}

export const MEALS: readonly MealMeta[] = [
  { id: 'b', name: '早餐' },
  { id: 'l', name: '午餐' },
  { id: 'd', name: '晚餐' },
  { id: 'm', name: '夜宵' },
]

export const CUISINES: readonly CuisineMeta[] = [
  { id: 'home', name: '家常菜' },
  { id: 'chuan', name: '川菜' },
  { id: 'yue', name: '粤菜' },
  { id: 'su', name: '苏菜' },
  { id: 'min', name: '闽菜' },
  { id: 'zhe', name: '浙菜' },
  { id: 'xiang', name: '湘菜' },
  { id: 'hui', name: '徽菜' },
  { id: 'dongbei', name: '东北菜' },
  { id: 'xibei', name: '西北新疆' },
  { id: 'yungui', name: '云贵菜' },
  { id: 'foreign', name: '外国菜' },
  // 自定义菜的专属分类：不与内置菜系混档，抽签页选它就只抽自己加的菜
  { id: 'my', name: '我的菜品' },
]

export const TAG_META: readonly TagMeta[] = [
  { id: 'quick', name: '快手', desc: '15 分钟内' },
  { id: 'xiafan', name: '下饭' },
  { id: 'jianzhi', name: '减脂轻食' },
  { id: 'yanke', name: '硬菜' },
  { id: 'light', name: '清淡' },
  { id: 'spicy', name: '辣' },
  { id: 'sour', name: '酸' },
  { id: 'sweet', name: '甜' },
]

export const AVOID_META: readonly AvoidMeta[] = [
  { id: 'coriander', name: '香菜', kw: ['香菜'] },
  { id: 'aromatics', name: '葱姜蒜', kw: ['葱', '姜', '蒜'] },
  { id: 'spicy', name: '辣', kw: [], tag: 'spicy' },
  { id: 'peanut', name: '花生坚果', kw: ['花生', '坚果', '芝麻', '松子'] },
  { id: 'seafood', name: '海鲜', kw: ['虾', '鱼', '贝', '蟹', '蚝', '蛎', '三文鱼', '海参', '鲍鱼', '花胶', '鱿'] },
  { id: 'mutton', name: '牛羊肉', kw: ['牛', '羊'] },
  { id: 'organ', name: '内脏', kw: ['肚', '肝', '肠', '血', '胗', '心', '舌'] },
  { id: 'alcohol', name: '酒精', kw: ['黄酒', '料酒', '啤酒', '白酒'] },
]

export const cuisineName = (id: string): string =>
  CUISINES.find((c) => c.id === id)?.name ?? id

export const mealName = (id: MealId): string =>
  MEALS.find((m) => m.id === id)?.name ?? id

/** 难度名称（如「中等」） */
export const levelName = (id: DishLevel): string =>
  LEVEL_META.find((l) => l.id === id)?.name ?? String(id)

/** 难度一句话说明（如「要腌要调汁，20~40 分钟」） */
export const levelDesc = (id: DishLevel): string =>
  LEVEL_META.find((l) => l.id === id)?.desc ?? ''
