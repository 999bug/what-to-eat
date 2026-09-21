/**
 * 应用外壳：侧栏（平板/桌面） / 底部 Tab（手机） + 主区 + 弹层 + 轻提示。
 * 只做导航与主题，业务状态全部来自 store。
 */
import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { applyTheme } from '@/theme'
import { SheetHost } from '@/components/Sheets'
import { VersionNote } from '@/components/VersionNote'
import { UpdateBanner } from '@/components/UpdateBanner'
import { DrawPage } from '@/pages/DrawPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { StatsPage } from '@/pages/StatsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { prettyDate, todayStr } from '@/lib/date'
import { isMobileWidth } from '@/lib/device'
import { haptics } from '@/lib/haptics'
import { mealName } from '@/data/meta'
import type { ViewId } from '@/types'

interface NavItem {
  id: ViewId
  name: string
  ico: string
  /** 顶部副标题（仅平板/桌面展示；手机端顶栏空间有限，只留日期与餐次） */
  sub: string
}

const NAV: readonly NavItem[] = [
  { id: 'draw', name: '抽签', ico: '🎲', sub: '不知道吃什么就交给它' },
  { id: 'calendar', name: '日历', ico: '📅', sub: '点任意一天看三餐' },
  { id: 'stats', name: '统计', ico: '📊', sub: '本月口味与热量概览' },
  { id: 'settings', name: '设置', ico: '⚙️', sub: '偏好、忌口与数据' },
]

const TOAST_MS = 1800

/** 周期性检查线上新版本的间隔：1 小时 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** 两次检查之间的最小间隔：切标签页/聚焦很频繁，避免每次都发请求 */
const UPDATE_MIN_GAP_MS = 60 * 1000

/**
 * 新版本检测节奏（对齐 cycling-analyzer 的布置方式）：
 * 加载时一次 + 每小时一次 + 切回标签页/窗口聚焦时一次。
 * 本项目没有 Service Worker，检测到新版本只能提示用户刷新，不做静默接管。
 */
function useUpdateWatch() {
  const checkUpdate = useAppStore((s) => s.checkUpdate)

  useEffect(() => {
    let last = 0
    const run = () => {
      const now = Date.now()
      if (now - last < UPDATE_MIN_GAP_MS) return
      last = now
      void checkUpdate()
    }

    run()
    const timer = window.setInterval(run, UPDATE_CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [checkUpdate])
}

function Toast() {
  const toast = useAppStore((s) => s.toast)
  const hideToast = useAppStore((s) => s.hideToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(hideToast, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null
  return (
    <div className="toast" role="status">
      {toast.msg}
    </div>
  )
}

function View() {
  const view = useAppStore((s) => s.view)
  if (view === 'calendar') return <CalendarPage />
  if (view === 'stats') return <StatsPage />
  if (view === 'settings') return <SettingsPage />
  return <DrawPage />
}

/** 手机端是否展示（<768px），随窗口变化实时更新 */
function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => isMobileWidth())
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 767px)')
    if (!mq) return
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function App() {
  const view = useAppStore((s) => s.view)
  const nav = useAppStore((s) => s.nav)
  const theme = useAppStore((s) => s.settings.theme)
  const meal = useAppStore((s) => s.meal)
  const midnight = useAppStore((s) => s.settings.midnight)
  const refreshCandidates = useAppStore((s) => s.refreshCandidates)
  const hasCandidates = useAppStore((s) => s.candidates.length > 0)
  const mobile = useMobile()

  // 主题变化时落到 <html>，auto 模式监听系统切换
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // 首屏补齐候选池（store 初始化时为空）
  useEffect(() => {
    if (!hasCandidates) refreshCandidates()
  }, [hasCandidates, refreshCandidates])

  useUpdateWatch()

  const cur = NAV.find((n) => n.id === view) ?? NAV[0]

  // 手机端顶栏只放「视图名 + 日期（抽签页再带当前餐次）」，
  // 原来的长副标题在 390px 下会被裁切。
  const mobileSub =
    view === 'draw'
      ? `${prettyDate(todayStr())}${!midnight && meal === 'm' ? '' : ' · ' + mealName(meal)}`
      : prettyDate(todayStr())

  return (
    <div className="app">
      <nav className="rail" aria-label="主导航">
        <div className="rail-brand">今天吃什么</div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={'rail-item' + (view === n.id ? ' on' : '')}
            onClick={() => nav(n.id)}
            aria-current={view === n.id ? 'page' : undefined}
          >
            <span className="ico">{n.ico}</span>
            <span className="lab">{n.name}</span>
          </button>
        ))}
        {/* 版本说明固定贴左侧栏底部（手机端另有一份收起态） */}
        <VersionNote />
      </nav>

      <main className={'main' + (mobile ? ' main-mobile' : '')}>
        <div className="wrap">
          <div className="topbar">
            <h1>{cur.name}</h1>
            <span className="sub">
              {mobile ? mobileSub : `${cur.sub} · ${prettyDate(todayStr())}`}
            </span>
          </div>
          <View />
          {/* 手机端侧栏隐藏，版本说明落到内容流末尾（默认收起，点开才展开） */}
          {mobile ? <VersionNote /> : null}
        </div>
      </main>

      <nav className="tabbar" aria-label="底部导航">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? 'on' : ''}
            onClick={() => {
              haptics.tap()
              nav(n.id)
            }}
            aria-current={view === n.id ? 'page' : undefined}
          >
            <span className="ico">{n.ico}</span>
            <span>{n.name}</span>
          </button>
        ))}
      </nav>

      {/* SW 卡 waiting 时的极端兜底横幅（常态渲染 null） */}
      <UpdateBanner />
      <SheetHost />
      <Toast />
    </div>
  )
}
