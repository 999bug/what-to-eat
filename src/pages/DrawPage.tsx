/** 抽签页：餐次切换 → 筛选 → 转盘/抽签桶 → 结果卡 → 一键记入 */
import { useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Wheel } from '@/components/Wheel'
import type { WheelHandle } from '@/components/Wheel'
import { DayPanel } from '@/components/DayPanel'
import { CUISINES, cuisineName, TAG_META } from '@/data/meta'
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
  const againResult = useAppStore((s) => s.againResult)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const openPick = useAppStore((s) => s.openPick)
  const midnight = useAppStore((s) => s.settings.midnight)
  const avoidCount = useAppStore((s) => s.settings.avoid.length)

  const wheelRef = useRef<WheelHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [lotWinId, setLotWinId] = useState<string | null>(null)

  const meals = midnight ? (['b', 'l', 'd', 'm'] as const) : (['b', 'l', 'd'] as const)

  const spin = () => {
    if (spinning || candidates.length === 0) return
    setResult(null)
    if (mode === 'wheel') {
      setSpinning(true)
      wheelRef.current?.spin()
    } else {
      // 抽签桶：先抖动再翻牌揭晓
      const idx = Math.floor(Math.random() * candidates.length)
      setSpinning(true)
      setLotWinId(null)
      window.setTimeout(() => setLotWinId(candidates[idx].id), 900)
      window.setTimeout(() => {
        setSpinning(false)
        setLotWinId(null)
        setResult(candidates[idx])
      }, 1450)
    }
  }

  const filterDesc = [
    filters.cuisines.length > 0 ? filters.cuisines.map(cuisineName).join('、') : null,
    filters.tags.length > 0
      ? filters.tags.map((t) => TAG_META.find((x) => x.id === t)?.name ?? t).join('、')
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="split">
      <div>
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
              <Wheel ref={wheelRef} items={candidates} onFinish={(d) => { setSpinning(false); setResult(d) }} />
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
            <div className="hint">
              {candidates.length > 0 ? `候选 ${candidates.length} 道` : '当前筛选下没有可抽的菜，试试放宽条件'}
            </div>
          </div>
        </div>

        {result ? (
          <div className="result">
            <div className="rname">
              {result.icon} {result.name}
              <span className="tagline">{cuisineName(result.cuisines[0])}</span>
            </div>
            <div className="rmeta">食材：{result.ingredients}</div>
            <div className="ring">约 {result.kcal} kcal / 份（估算值）</div>
            <div className="acts">
              <button className="btn btn-primary" onClick={acceptResult}>
                就吃这个
              </button>
              <button className="btn" onClick={againResult}>
                换一个
              </button>
              <button className="btn" onClick={() => openPick(todayStr(), meal)}>
                记入其他餐次
              </button>
              <button className="btn btn-sm" onClick={() => toggleFavorite(result.id)}>
                {favorites.includes(result.id) ? '已收藏' : '收藏'}
              </button>
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
