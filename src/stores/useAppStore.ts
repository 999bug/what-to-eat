/**
 * 全局状态（zustand 单 store）。
 * 分层约定：组件只调 actions，不直接改状态、不碰 localStorage；
 * 持久化数据（records / settings / favorites）的每次变更立即落盘。
 */
import { create } from 'zustand'
import type {
  CustomDish,
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
import { customToDishes, mergeCustomDishes, normalizeCustom, readCustomDishes } from '@/lib/custom'
import { fetchRemoteVersion, isNewer } from '@/lib/version'
import { mealName } from '@/data/meta'
import { seedRecords } from '@/data/seed'

export const DEFAULT_SETTINGS: Settings = {
  // 默认跟随系统（PRD §6.2 暗色优先：主使用场景是饭点，暗色更舒适）
  theme: 'auto',
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

/** 自定义菜品（localStorage wte:v1:customDishes）：容错读取，脏数据不阻塞页面 */
const initialCustomDishes = (): CustomDish[] => readCustomDishes(loadItem<unknown>('customDishes', []))

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
  sheet: 'filters' | 'pick' | 'version' | null
  pickDate: string
  pickMeal: MealId
  pickQuery: string
  /** 手动录入菜品面板是否展开（补录面板内） */
  customFormOpen: boolean
  /** 正在编辑的自定义菜品 id；null = 新建 */
  editingCustomId: string | null
  /** 轻提示（1.8s 自动消失） */
  toast: { id: number; msg: string } | null
  /** 远端检测到的新版本（null = 无更新或尚未检测） */
  updateVersion: string | null

  // ---- 持久化态 ----
  records: MealRecord[]
  settings: Settings
  favorites: string[]
  /** 用户自定义菜品（参与抽取池，与内置菜库同口径过滤） */
  customDishes: CustomDish[]

  // ---- actions ----
  nav: (v: ViewId) => void
  setMeal: (m: MealId) => void
  toggleCuisine: (c: string) => void
  toggleTag: (t: string) => void
  toggleLevel: (l: DishLevel) => void
  toggleAvoid: (a: string) => void
  /** 清空忌口（空候选时的出路之一） */
  clearAvoid: () => void
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
  /** 打开／收起手动录入表单；传入 id 表示编辑既有菜品 */
  openCustomForm: (id?: string) => void
  closeCustomForm: () => void
  /** 新增自定义菜品；返回新建的菜品（供调用方决定是否补记一条记录） */
  addCustomDish: (input: CustomDishInput) => CustomDish
  /** 保存编辑（保持 id 不变，历史记录仍指向同一道菜） */
  updateCustomDish: (id: string, input: CustomDishInput) => void
  /** 删除自定义菜品（历史记录保留，只从菜库移除） */
  deleteCustomDish: (id: string) => void
  setSelDate: (d: string) => void
  shiftMonth: (delta: number) => void
  goThisMonth: () => void
  openFilters: () => void
  openPick: (date: string, meal: MealId) => void
  /** 打开版本说明（当前版本 + 更新日志 + 检查更新） */
  openVersion: () => void
  closeSheet: () => void
  setPickQuery: (q: string) => void
  /** 检测线上是否已有新版本（离线或请求失败时静默，不打扰用户） */
  checkUpdate: () => Promise<void>
  /** 应用更新：刷新页面，取回最新静态资源 */
  applyUpdate: () => void
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

/** 手动录入的原始输入（组件只负责收集，规范化在 lib/custom.ts） */
export interface CustomDishInput {
  name: string
  icon?: string
  kcal?: number | null
  cuisines?: string[]
  meals?: MealId[]
  ingredients?: string
  tags?: string[]
  level?: DishLevel
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
    return poolForMeal(
      s.meal,
      s.filters.cuisines,
      s.filters.tags,
      s.settings.avoid,
      s.filters.levels,
      customToDishes(s.customDishes),
    )
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
    customFormOpen: false,
    editingCustomId: null,
    toast: null,
    updateVersion: null,

    records: initialRecords(),
    settings: settings0,
    favorites: loadItem<string[]>('favorites', []),
    customDishes: initialCustomDishes(),

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

    clearAvoid: () => {
      const settings = { ...get().settings, avoid: [] }
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
        customToDishes(s.customDishes),
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
      // 自定义菜品未填热量时 kcalKnown=false：kcal 记 0，统计侧不把它算进日均分母
      const kcalKnown = dish.kcalKnown !== false
      const rec: MealRecord = {
        id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
        date,
        meal,
        dishId: dish.id,
        dishName: dish.name,
        icon: dish.icon,
        cuisine: dish.cuisines[0],
        servings,
        kcal: kcalKnown ? Math.round(dish.kcal * servings) : 0,
        kcalKnown,
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

    /* ---------- 自定义菜品 ---------- */

    openCustomForm: (id) => set({ customFormOpen: true, editingCustomId: id ?? null }),
    closeCustomForm: () => set({ customFormOpen: false, editingCustomId: null }),

    addCustomDish: (input) => {
      const dish = normalizeCustom(input)
      const customDishes = [...get().customDishes, dish]
      saveItem('customDishes', customDishes)
      set({ customDishes })
      // 菜库变了，候选池要跟着刷新，否则新菜抽不到
      get().refreshCandidates()
      return dish
    },

    updateCustomDish: (id, input) => {
      const customDishes = get().customDishes.map((c) =>
        c.id === id
          ? // 保留原 id 与 createdAt：历史记录靠 id 关联，改了就会失联
            normalizeCustom(input, c.id, c.createdAt)
          : c,
      )
      saveItem('customDishes', customDishes)
      set({ customDishes })
      get().refreshCandidates()
    },

    deleteCustomDish: (id) => {
      const customDishes = get().customDishes.filter((c) => c.id !== id)
      saveItem('customDishes', customDishes)
      // 顺手清掉收藏与「已展示」里的引用，避免脏 id 影响去重
      const favorites = get().favorites.filter((f) => f !== id)
      saveItem('favorites', favorites)
      set({
        customDishes,
        favorites,
        shownIds: get().shownIds.filter((s) => s !== id),
      })
      get().refreshCandidates()
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
    openVersion: () => set({ sheet: 'version' }),
    closeSheet: () => set({ sheet: null }),
    setPickQuery: (q) => set({ pickQuery: q }),

    checkUpdate: async () => {
      const remote = await fetchRemoteVersion()
      if (!remote) return
      if (!isNewer(remote, __APP_VERSION__)) return
      if (get().updateVersion === remote) return
      set({ updateVersion: remote })
    },

    applyUpdate: () => {
      window.location.reload()
    },

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
        [
          JSON.stringify(
            {
              records: s.records,
              settings: s.settings,
              favorites: s.favorites,
              customDishes: s.customDishes,
            },
            null,
            2,
          ),
        ],
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
          customDishes?: unknown
        }
        const settings: Settings = { ...DEFAULT_SETTINGS, ...(o.settings ?? get().settings) }
        const records = o.records ?? get().records
        const favorites = o.favorites ?? get().favorites
        // 旧备份没有 customDishes 字段：保留本地已有的，不能清空
        const customDishes =
          o.customDishes === undefined
            ? get().customDishes
            : mergeCustomDishes(get().customDishes, readCustomDishes(o.customDishes))
        saveItem('records', records)
        saveItem('settings', settings)
        saveItem('favorites', favorites)
        saveItem('customDishes', customDishes)
        set({ records, settings, favorites, customDishes })
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
