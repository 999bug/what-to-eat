/**
 * 全局状态（zustand 单 store）。
 * 分层约定：组件只调 actions，不直接改状态、不碰 localStorage；
 * 持久化数据（records / settings / favorites）的每次变更立即落盘。
 */
import { create } from 'zustand'
import type {
  Dish,
  DishLevel,
  Filters,
  MealId,
  MealRecord,
  RecordSource,
  Settings,
  ViewId,
} from '@/types'
import { loadItem, saveItem } from '@/lib/storage'
import { todayStr, monthOf, prettyDate } from '@/lib/date'
import { pickCandidates, pickWeighted, poolForMeal } from '@/lib/pool'
import { mealName } from '@/data/meta'
import { seedRecords } from '@/data/seed'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  midnight: false,
  serving: 1,
  goalOn: false,
  goal: 1800,
  avoid: [],
  dedupe: true,
  mode: 'wheel',
}

/** 首次进入（无本地记录）时写入确定性示例数据 */
const initialRecords = (): MealRecord[] => {
  const stored = loadItem<MealRecord[] | null>('records', null)
  if (stored !== null) return stored
  const seeded = seedRecords()
  saveItem('records', seeded)
  return seeded
}

export interface AppState {
  // ---- 会话态 ----
  view: ViewId
  meal: MealId
  filters: Filters
  candidates: Dish[]
  result: Dish | null
  /** 本次会话已展示过的结果（「换一个」时排除） */
  shownIds: string[]
  selDate: string
  month: string
  sheet: 'filters' | 'pick' | null
  pickDate: string
  pickMeal: MealId
  pickQuery: string
  /** 轻提示（1.8s 自动消失） */
  toast: { id: number; msg: string } | null

  // ---- 持久化态 ----
  records: MealRecord[]
  settings: Settings
  favorites: string[]

  // ---- actions ----
  nav: (v: ViewId) => void
  setMeal: (m: MealId) => void
  toggleCuisine: (c: string) => void
  toggleTag: (t: string) => void
  toggleLevel: (l: DishLevel) => void
  toggleAvoid: (a: string) => void
  clearFilters: () => void
  setMode: (m: 'wheel' | 'lots') => void
  refreshCandidates: () => void
  /** 直接指定结果（转盘／抽签桶动画结束时回调） */
  setResult: (d: Dish | null) => void
  clearResult: () => void
  /** 就吃这个：写入当前餐次 */
  acceptResult: () => void
  /**
   * 换一个：算出下一道菜（排除本次已展示过的），**不直接写入 result**。
   * 返回给调用方去驱动转盘/抽签桶动画，动画结束再由 setResult 落结果。
   */
  nextCandidate: () => Dish | null
  /** 就地抽取并写入指定日期餐次 */
  drawFor: (date: string, meal: MealId) => void
  addRecord: (dish: Dish, date: string, meal: MealId, source: RecordSource) => void
  deleteRecord: (id: string) => void
  toggleFavorite: (dishId: string) => void
  setSelDate: (d: string) => void
  shiftMonth: (delta: number) => void
  goThisMonth: () => void
  openFilters: () => void
  openPick: (date: string, meal: MealId) => void
  closeSheet: () => void
  setPickQuery: (q: string) => void
  updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void
  toggleSetting: (k: 'midnight' | 'dedupe' | 'goalOn') => void
  exportData: () => void
  importData: (json: string) => void
  reseed: () => void
  clearRecords: () => void
  showToast: (msg: string) => void
  hideToast: () => void
}

/** 按当前时间推断默认餐次（夜宵未开启时 21 点后归入晚餐） */
export function mealByTime(midnight: boolean): MealId {
  const h = new Date().getHours()
  if (h < 10) return 'b'
  if (h < 15) return 'l'
  if (h < 21) return 'd'
  return midnight ? 'm' : 'd'
}

const initialSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...loadItem<Partial<Settings>>('settings', {}),
})

export const useAppStore = create<AppState>((set, get) => {
  const settings0 = initialSettings()

  /** 组合当前筛选条件的候选池（多处复用） */
  const currentPool = () => {
    const s = get()
    return poolForMeal(s.meal, s.filters.cuisines, s.filters.tags, s.settings.avoid, s.filters.levels)
  }

  return {
    view: 'draw',
    meal: mealByTime(settings0.midnight),
    filters: { cuisines: [], tags: [], levels: [] },
    candidates: [],
    result: null,
    shownIds: [],
    selDate: todayStr(),
    month: monthOf(todayStr()),
    sheet: null,
    pickDate: todayStr(),
    pickMeal: 'l',
    pickQuery: '',
    toast: null,

    records: initialRecords(),
    settings: settings0,
    favorites: loadItem<string[]>('favorites', []),

    nav: (v) => {
      set({ view: v, result: null, shownIds: [] })
      if (v === 'draw' && get().candidates.length === 0) get().refreshCandidates()
    },

    setMeal: (m) => {
      set({ meal: m, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    toggleCuisine: (c) => {
      const cur = get().filters.cuisines
      const next = c === '' ? [] : cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
      set({ filters: { ...get().filters, cuisines: next }, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    toggleTag: (t) => {
      const cur = get().filters.tags
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]
      set({ filters: { ...get().filters, tags: next }, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    toggleLevel: (l) => {
      const cur = get().filters.levels
      const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]
      set({ filters: { ...get().filters, levels: next }, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    toggleAvoid: (a) => {
      const cur = get().settings.avoid
      const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]
      const settings = { ...get().settings, avoid: next }
      saveItem('settings', settings)
      set({ settings, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    clearFilters: () => {
      set({ filters: { cuisines: [], tags: [], levels: [] }, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    setMode: (m) => {
      const settings = { ...get().settings, mode: m }
      saveItem('settings', settings)
      set({ settings, result: null, shownIds: [] })
      get().refreshCandidates()
    },

    refreshCandidates: () => {
      const s = get()
      const pool = currentPool()
      set({
        candidates: pickCandidates(pool, s.records, s.favorites, s.settings.dedupe),
      })
    },

    setResult: (d) => set({ result: d }),

    clearResult: () => set({ result: null }),

    acceptResult: () => {
      const s = get()
      if (!s.result) return
      s.addRecord(s.result, todayStr(), s.meal, 'draw')
      const t = todayStr()
      s.showToast(`已记入 ${prettyDate(t)} ${mealName(s.meal)}`)
      set({ result: null, shownIds: [] })
      get().refreshCandidates()
    },

    /**
     * 换一个：算出下一道菜（排除本次已展示过的），不直接写 result——
     * 由调用方拿它去驱动转盘/抽签桶动画，动画结束再 setResult。
     */
    nextCandidate: () => {
      const s = get()
      if (s.candidates.length === 0) return null
      const shown = s.result ? [...s.shownIds, s.result.id] : s.shownIds
      const next =
        pickWeighted(s.candidates, s.records, s.favorites, s.settings.dedupe, shown) ??
        pickWeighted(s.candidates, s.records, s.favorites, s.settings.dedupe, [])
      if (!next) return null
      set({ shownIds: shown })
      return next
    },

    drawFor: (date, meal) => {
      const s = get()
      const pool = poolForMeal(
        meal,
        s.filters.cuisines,
        s.filters.tags,
        s.settings.avoid,
        s.filters.levels,
      )
      const d = pickWeighted(pool, s.records, s.favorites, s.settings.dedupe, [])
      if (!d) {
        s.showToast('当前筛选下没有可抽的菜，试试放宽条件')
        return
      }
      s.addRecord(d, date, meal, 'draw')
      s.showToast(`已为${mealName(meal)}记入 ${d.name}`)
    },

    addRecord: (dish, date, meal, source) => {
      const s = get()
      const servings = s.settings.serving || 1
      const rec: MealRecord = {
        id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
        date,
        meal,
        dishId: dish.id,
        dishName: dish.name,
        icon: dish.icon,
        cuisine: dish.cuisines[0],
        servings,
        kcal: Math.round(dish.kcal * servings),
        source,
        createdAt: new Date().toISOString(),
      }
      const records = [...s.records, rec]
      saveItem('records', records)
      set({ records })
    },

    deleteRecord: (id) => {
      const records = get().records.filter((r) => r.id !== id)
      saveItem('records', records)
      set({ records })
    },

    toggleFavorite: (dishId) => {
      const cur = get().favorites
      const favorites = cur.includes(dishId)
        ? cur.filter((x) => x !== dishId)
        : [...cur, dishId]
      saveItem('favorites', favorites)
      set({ favorites })
    },

    setSelDate: (d) => set({ selDate: d }),
    shiftMonth: (delta) => {
      const [y, m] = get().month.split('-').map(Number)
      const d = new Date(y, m - 1 + delta, 1)
      const mm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      set({ month: mm })
    },
    goThisMonth: () => set({ month: monthOf(todayStr()), selDate: todayStr() }),

    openFilters: () => set({ sheet: 'filters' }),
    openPick: (date, meal) => set({ sheet: 'pick', pickDate: date, pickMeal: meal, pickQuery: '' }),
    closeSheet: () => set({ sheet: null }),
    setPickQuery: (q) => set({ pickQuery: q }),

    updateSetting: (k, v) => {
      const settings = { ...get().settings, [k]: v }
      saveItem('settings', settings)
      set({ settings })
    },

    toggleSetting: (k) => {
      const settings = { ...get().settings, [k]: !get().settings[k] }
      saveItem('settings', settings)
      set({ settings })
    },

    exportData: () => {
      const s = get()
      const blob = new Blob(
        [JSON.stringify({ records: s.records, settings: s.settings, favorites: s.favorites }, null, 2)],
        { type: 'application/json' },
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'what-to-eat-备份.json'
      a.click()
      URL.revokeObjectURL(url)
      s.showToast('已导出备份文件')
    },

    importData: (json) => {
      try {
        const o = JSON.parse(json) as {
          records?: MealRecord[]
          settings?: Partial<Settings>
          favorites?: string[]
        }
        const settings = { ...DEFAULT_SETTINGS, ...(o.settings ?? get().settings) }
        const records = o.records ?? get().records
        const favorites = o.favorites ?? get().favorites
        saveItem('records', records)
        saveItem('settings', settings)
        saveItem('favorites', favorites)
        set({ records, settings, favorites })
        get().showToast('导入成功')
        get().refreshCandidates()
      } catch {
        get().showToast('文件格式不正确')
      }
    },

    reseed: () => {
      const records = seedRecords()
      saveItem('records', records)
      set({ records })
      get().showToast('已重置示例数据')
    },

    clearRecords: () => {
      saveItem('records', [])
      set({ records: [] })
      get().showToast('记录已清空')
    },

    showToast: (msg) => set({ toast: { id: Date.now(), msg } }),
    hideToast: () => set({ toast: null }),
  }
})
