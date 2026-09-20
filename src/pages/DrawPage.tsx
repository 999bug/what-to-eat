/** 抽签页：餐次切换 → 筛选 → 转盘/抽签桶 → 结果卡 → 一键记入 */
import { useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Wheel } from '@/components/Wheel'
import type { WheelHandle } from '@/components/Wheel'
import { DayPanel } from '@/components/DayPanel'
import { CUISINES, cuisineName, levelDesc, levelName, TAG_META } from '@/data/meta'
import { todayStr } from '@/lib/date'

export function DrawPage() {
  const meal = useAppStore((s) => s.meal)
  const setMeal = useAppStore((s) => s.setMeal)
  const filters = useAppStore((s) => s.filters)
  const toggleCuisine = useAppStore((s) => s.toggleCuisine)
  const clearFilters = useAppStore((s) => s.clearFilters)
  const candidates = useAppStore((s) => s.candidates)
  const result = useAppStore((s) => s.result)
  const mode = useAppStore((s) => s.settings.mode)
  const setMode = useAppStore((s) => s.setMode)
  const openFilters = useAppStore((s) => s.openFilters)
  const acceptResult = useAppStore((s) => s.acceptResult)
  const setResult = useAppStore((s) => s.setResult)
  const nextCandidate = useAppStore((s) => s.nextCandidate)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const openPick = useAppStore((s) => s.openPick)
  const midnight = useAppStore((s) => s.settings.midnight)
  const avoidCount = useAppStore((s) => s.settings.avoid.length)
  const openVersion = useAppStore((s) => s.openVersion)
  const updateVersion = useAppStore((s) => s.updateVersion)
  const applyUpdate = useAppStore((s) => s.applyUpdate)

  const wheelRef = useRef<WheelHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [lotWinId, setLotWinId] = useState<string | null>(null)
  /** 结果浮层是否展开：抽出结果后自动居中弹出，关闭后可在转盘下方再次点开 */
  const [resultOpen, setResultOpen] = useState(false)

  const meals = midnight ? (['b', 'l', 'd', 'm'] as const) : (['b', 'l', 'd'] as const)

  /** 转盘：转到 targetId 指定的那道菜；不传则随机 */
  const spinWheel = (targetId?: string) => {
    setSpinning(true)
    setResult(null)
    setResultOpen(false)
    wheelRef.current?.spin(targetId)
  }

  /** 抽签桶：先整桶抖动，再翻牌揭晓 */
  const shakeLots = (targetId: string) => {
    setSpinning(true)
    setResult(null)
    setResultOpen(false)
    setLotWinId(null)
    window.setTimeout(() => setLotWinId(targetId), 900)
    window.setTimeout(() => {
      setSpinning(false)
      setLotWinId(null)
      const d = candidates.find((x) => x.id === targetId)
      if (d) {
        setResult(d)
        setResultOpen(true)
      }
    }, 1450)
  }

  const spin = () => {
    if (spinning || candidates.length === 0) return
    setResult(null)
    setResultOpen(false)
    if (mode === 'wheel') {
      spinWheel()
    } else {
      const idx = Math.floor(Math.random() * candidates.length)
      shakeLots(candidates[idx].id)
    }
  }

  /** 换一个：先按去重规则算出下一道，再重新转一次转盘 / 重新洗牌 */
  const again = () => {
    if (spinning) return
    const next = nextCandidate()
    if (!next) return
    if (mode === 'wheel') spinWheel(next.id)
    else shakeLots(next.id)
  }

  const filterDesc = [
    filters.cuisines.length > 0 ? filters.cuisines.map(cuisineName).join('、') : null,
    filters.tags.length > 0
      ? filters.tags.map((t) => TAG_META.find((x) => x.id === t)?.name ?? t).join('、')
      : null,
    filters.levels.length > 0
      ? '难度' + filters.levels.slice().sort().map(levelName).join('、')
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="split">
      <div>
        <div className="verbar">
          <button className="btn btn-sm btn-ghost" onClick={openVersion}>
            版本说明 · v{__APP_VERSION__}
          </button>
          {updateVersion ? (
            <button className="btn btn-sm" onClick={applyUpdate}>
              有新版本 v{updateVersion} · 点此刷新
            </button>
          ) : null}
        </div>

        <div className="card">
          <div className="meals">
            {meals.map((m) => (
              <button key={m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>
                {m === 'b' ? '早餐' : m === 'l' ? '午餐' : m === 'd' ? '晚餐' : '夜宵'}
              </button>
            ))}
          </div>
          <div className="hint left">按当前时间自动选中，可手动切换；菜库按餐次过滤</div>
        </div>

        <div className="card">
          <div className="card-t">
            菜系
            <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
              清除筛选
            </button>
          </div>
          <div className="chips">
            <button
              className={'chip' + (filters.cuisines.length === 0 ? ' on' : '')}
              onClick={() => toggleCuisine('')}
            >
              全部
            </button>
            {CUISINES.map((c) => (
              <button
                key={c.id}
                className={'chip' + (filters.cuisines.includes(c.id) ? ' on' : '')}
                onClick={() => toggleCuisine(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="row-acts">
            <button className="btn btn-sm" onClick={openFilters}>
              更多筛选
            </button>
            <button
              className={'btn btn-sm' + (mode === 'wheel' ? ' on' : '')}
              onClick={() => setMode('wheel')}
            >
              转盘
            </button>
            <button
              className={'btn btn-sm' + (mode === 'lots' ? ' on' : '')}
              onClick={() => setMode('lots')}
            >
              抽签桶
            </button>
          </div>
          <div className="hint left">
            {filterDesc !== '' || avoidCount > 0
              ? '当前：' +
                [filterDesc, avoidCount > 0 ? `忌口 ${avoidCount} 项` : null].filter(Boolean).join(' · ')
              : '当前：全部菜库 · 惊喜模式'}
          </div>
        </div>

        <div className="card">
          <div className="wheel-box">
            {mode === 'wheel' ? (
              <Wheel
                ref={wheelRef}
                items={candidates}
                onFinish={(d) => {
                  setSpinning(false)
                  setResult(d)
                  setResultOpen(true)
                }}
              />
            ) : (
              <div className="lots">
                {candidates.map((d) => (
                  <div
                    key={d.id}
                    className={'lot' + (spinning ? ' shake' : '') + (lotWinId === d.id ? ' win' : '')}
                  >
                    🎴
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" onClick={spin} disabled={spinning}>
              {spinning ? '抽取中…' : '今天吃什么'}
            </button>
            {result && !resultOpen ? (
              <button className="btn btn-sm btn-ghost btn-block" onClick={() => setResultOpen(true)}>
                查看结果：{result.icon} {result.name}
              </button>
            ) : null}
            <div className="hint">
              {candidates.length > 0 ? `候选 ${candidates.length} 道` : '当前筛选下没有可抽的菜，试试放宽条件'}
            </div>
          </div>
        </div>

        {result && resultOpen ? (
          <div
            className="rmask"
            onClick={() => setResultOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="抽签结果"
          >
            <div className="result" onClick={(e) => e.stopPropagation()}>
              <div className="rname">
                {result.icon} {result.name}
                <span className="tagline">{cuisineName(result.cuisines[0])}</span>
                <span className="lvl">{levelName(result.level)}</span>
              </div>
              <div className="rmeta">食材：{result.ingredients}</div>
              <div className="ring">
                约 {result.kcal} kcal / 份（估算值） · 难度{levelName(result.level)}（
                {levelDesc(result.level)}）
              </div>
              <div className="acts">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    acceptResult()
                    setResultOpen(false)
                  }}
                >
                  就吃这个
                </button>
                <button className="btn" onClick={again} disabled={spinning}>
                  换一个
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setResultOpen(false)
                    openPick(todayStr(), meal)
                  }}
                >
                  记入其他餐次
                </button>
                <button className="btn btn-sm" onClick={() => toggleFavorite(result.id)}>
                  {favorites.includes(result.id) ? '已收藏' : '收藏'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setResultOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <DayPanel date={todayStr()} compact />
      </div>
    </div>
  )
}
