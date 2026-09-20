/**
 * 应用外壳：侧栏（平板/桌面） / 底部 Tab（手机） + 主区 + 弹层 + 轻提示。
 * 只做导航与主题，业务状态全部来自 store。
 */
import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { applyTheme } from '@/theme'
import { SheetHost } from '@/components/Sheets'
import { DrawPage } from '@/pages/DrawPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { StatsPage } from '@/pages/StatsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { prettyDate, todayStr } from '@/lib/date'
import type { ViewId } from '@/types'

interface NavItem {
  id: ViewId
  name: string
  ico: string
  /** 顶部副标题 */
  sub: string
}

const NAV: readonly NavItem[] = [
  { id: 'draw', name: '抽签', ico: '🎲', sub: '不知道吃什么就交给它' },
  { id: 'calendar', name: '日历', ico: '📅', sub: '点任意一天看三餐' },
  { id: 'stats', name: '统计', ico: '📊', sub: '本月口味与热量概览' },
  { id: 'settings', name: '设置', ico: '⚙️', sub: '偏好、忌口与数据' },
]

const TOAST_MS = 1800

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

export default function App() {
  const view = useAppStore((s) => s.view)
  const nav = useAppStore((s) => s.nav)
  const theme = useAppStore((s) => s.settings.theme)
  const refreshCandidates = useAppStore((s) => s.refreshCandidates)
  const hasCandidates = useAppStore((s) => s.candidates.length > 0)

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

  const cur = NAV.find((n) => n.id === view) ?? NAV[0]

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
      </nav>

      <main className="main">
        <div className="wrap">
          <div className="topbar">
            <h1>{cur.name}</h1>
            <span className="sub">
              {cur.sub} · {prettyDate(todayStr())}
            </span>
          </div>
          <View />
        </div>
      </main>

      <nav className="tabbar" aria-label="底部导航">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? 'on' : ''}
            onClick={() => nav(n.id)}
            aria-current={view === n.id ? 'page' : undefined}
          >
            <span className="ico">{n.ico}</span>
            <span>{n.name}</span>
          </button>
        ))}
      </nav>

      <SheetHost />
      <Toast />
    </div>
  )
}
