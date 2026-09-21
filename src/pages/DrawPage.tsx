/**
 * 抽签页：餐次切换 → 筛选 → 转盘/抽签桶 → 结果卡 → 一键记入
 *
 * 移动端布局（<768px）：吸顶餐次分段控件 → 已选条件 chip 行
 *   → 转盘吃满剩余高度 → 固定底部 CTA。核心动作一屏闭环，不需要滑动。
 * 平板 / 桌面：沿用「左抽签 + 右今日」双栏，不改变既有习惯。
 */
import { useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Wheel } from '@/components/Wheel'
import type { WheelHandle } from '@/components/Wheel'
import { DayPanel } from '@/components/DayPanel'
import { ResultSheet, useIsMobile } from '@/components/ResultSheet'
import { CUISINES, cuisineName, levelName, TAG_META } from '@/data/meta'
import { todayStr } from '@/lib/date'
import { haptics } from '@/lib/haptics'
import { MEALS } from '@/data/meta'
import type { MealId } from '@/types'

/** 餐次名称（含夜宵） */
export function mealNameOf(m: MealId): string {
  return MEALS.find((x) => x.id === m)?.name ?? m
}

export function DrawPage() {
  const meal = useAppStore((s) => s.meal)
  const setMeal = useAppStore((s) => s.setMeal)
  const filters = useAppStore((s) => s.filters)
  const toggleCuisine = useAppStore((s) => s.toggleCuisine)
  const toggleTag = useAppStore((s) => s.toggleTag)
  const toggleLevel = useAppStore((s) => s.toggleLevel)
  const clearFilters = useAppStore((s) => s.clearFilters)
  const candidates = useAppStore((s) => s.candidates)
  const result = useAppStore((s) => s.result)
  const mode = useAppStore((s) => s.settings.mode)
  const setMode = useAppStore((s) => s.setMode)
  const openFilters = useAppStore((s) => s.openFilters)
  const setResult = useAppStore((s) => s.setResult)
  const nextCandidate = useAppStore((s) => s.nextCandidate)
  const midnight = useAppStore((s) => s.settings.midnight)
  const avoid = useAppStore((s) => s.settings.avoid)
  const clearAvoid = useAppStore((s) => s.clearAvoid)

  const wheelRef = useRef<WheelHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [lotWinId, setLotWinId] = useState<string | null>(null)
  /** 结果卡是否展开：抽出后自动弹出，关闭后可在转盘下方再次点开 */
  const [resultOpen, setResultOpen] = useState(false)
  const mobile = useIsMobile()

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
    haptics.tap()
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
    setResultOpen(false)
    if (mode === 'wheel') spinWheel(next.id)
    else shakeLots(next.id)
  }

  /** 已选条件（手机端以可删除 chip 呈现） */
  const activeChips = [
    ...filters.cuisines.map((c) => ({
      key: 'c:' + c,
      label: cuisineName(c),
      off: () => toggleCuisine(c),
    })),
    ...filters.tags.map((t) => ({
      key: 't:' + t,
      label: TAG_META.find((x) => x.id === t)?.name ?? t,
      off: () => toggleTag(t),
    })),
    ...filters.levels.map((l) => ({ key: 'l:' + l, label: levelName(l), off: () => toggleLevel(l) })),
  ]

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
    <div className={'split' + (mobile ? ' split-mobile' : '')}>
      <div>
        {/* 餐次：手机端为吸顶分段控件并去掉解释文字，桌面沿用卡片 */}
        <div className={'card' + (mobile ? ' card-meals-mobile' : '')}>
          <div className="meals">
            {meals.map((m) => (
              <button
                key={m}
                className={meal === m ? 'on' : ''}
                onClick={() => {
                  haptics.select()
                  setMeal(m)
                }}
              >
                {mealNameOf(m)}
              </button>
            ))}
          </div>
          {mobile ? null : (
            <div className="hint left">按当前时间自动选中，可手动切换；菜库按餐次过滤</div>
          )}
        </div>

        {mobile ? (
          /* 手机端：一行可删除的已选条件，取代横向滚动的 12 个菜系 chip */
          <div className="fchip-row">
            <button className="fchip ghost" onClick={openFilters}>
              {activeChips.length === 0 && avoid.length === 0
                ? '＋ 筛选'
                : `筛选 ${activeChips.length + avoid.length} 项`}
            </button>
            {activeChips.map((c) => (
              <button
                key={c.key}
                className="fchip"
                onClick={() => {
                  haptics.tap()
                  c.off()
                }}
              >
                {c.label}
                <span className="x" aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
            {avoid.length > 0 ? <span className="fchip static">忌口 {avoid.length} 项</span> : null}
          </div>
        ) : (
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
              {filterDesc !== '' || avoid.length > 0
                ? '当前：' +
                  [filterDesc, avoid.length > 0 ? `忌口 ${avoid.length} 项` : null]
                    .filter(Boolean)
                    .join(' · ')
                : '当前：全部菜库 · 惊喜模式'}
            </div>
          </div>
        )}

        <div className={'card' + (mobile ? ' card-wheel-mobile' : '')}>
          <div className="wheel-box">
            {mobile ? (
              /* 手机端：玩法切换与清筛选做成图标，不占首屏 */
              <div className="wheel-tools">
                <button
                  className="icon-btn"
                  onClick={() => {
                    haptics.tap()
                    clearFilters()
                  }}
                  aria-label="清除筛选"
                >
                  ⟲
                </button>
                <button
                  className="icon-btn on"
                  onClick={() => {
                    haptics.select()
                    setMode(mode === 'wheel' ? 'lots' : 'wheel')
                  }}
                  aria-label={mode === 'wheel' ? '切换到抽签桶' : '切换到转盘'}
                >
                  {mode === 'wheel' ? '🎡' : '🎴'}
                </button>
              </div>
            ) : null}

            {mode === 'wheel' ? (
              /* 转盘整体可点即抽（桌面 + 手机都开：桌面之前只能点下方按钮，转盘像个摆设） */
              <div className="wheel-tap" onClick={spin} role="button" aria-label="转动转盘">
                <Wheel
                  ref={wheelRef}
                  items={candidates}
                  onFinish={(d) => {
                    setSpinning(false)
                    setResult(d)
                    setResultOpen(true)
                  }}
                />
              </div>
            ) : (
              /* 抽签桶：签牌本身也能点（点哪张都是整桶开抽），抽出后中奖签翻牌亮出菜名 */
              <div className="lots">
                {candidates.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    className={
                      'lot' +
                      (spinning ? ' shake' : '') +
                      (lotWinId === d.id ? ' win' : '') +
                      (lotWinId && lotWinId !== d.id ? ' dim' : '')
                    }
                    style={
                      spinning && !lotWinId ? { animationDelay: `${(i % 4) * 70}ms` } : undefined
                    }
                    onClick={spin}
                    disabled={spinning}
                    aria-label={lotWinId === d.id ? `抽中 ${d.name}` : `点此开抽（第 ${i + 1} 签）`}
                  >
                    <span className="lot-body">
                      {lotWinId === d.id ? (
                        <>
                          <span className="lot-ico" aria-hidden="true">
                            {d.icon}
                          </span>
                          <span className="lot-name">{d.name}</span>
                        </>
                      ) : (
                        /* 未揭晓：签头 + 竖排「食」字标签，做成一支真签的样子 */
                        <span className="lot-face" aria-hidden="true">
                          <span className="lot-cap">食</span>
                          <span className="lot-mark">签</span>
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {mobile ? null : (
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={spin}
                disabled={spinning}
              >
                {spinning ? '抽取中…' : '今天吃什么'}
              </button>
            )}

            {result && !resultOpen ? (
              <button
                className="btn btn-sm btn-ghost btn-block"
                onClick={() => {
                  haptics.tap()
                  setResultOpen(true)
                }}
              >
                查看结果：{result.icon} {result.name}
              </button>
            ) : null}

            <div className="hint">
              {candidates.length > 0
                ? `候选 ${candidates.length} 道 · 点${
                    mode === 'wheel' ? '转盘' : '签牌'
                  }开抽`
                : '当前筛选下没有可抽的菜，试试放宽条件'}
            </div>
          </div>
        </div>

        {/* 空候选：给出明确出路，而不是让用户对着空转盘发呆 */}
        {candidates.length === 0 ? (
          <div className="card">
            <div className="empty">没有符合条件的菜</div>
            <div className="row-acts">
              <button className="btn btn-primary btn-sm" onClick={clearFilters}>
                清除全部筛选
              </button>
              {avoid.length > 0 ? (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    haptics.tap()
                    clearAvoid()
                  }}
                >
                  清空忌口
                </button>
              ) : null}
              <button className="btn btn-sm" onClick={openFilters}>
                调整筛选
              </button>
            </div>
          </div>
        ) : null}

        {result && resultOpen ? (
          <ResultSheet
            dish={result}
            mobile={mobile}
            onClose={() => setResultOpen(false)}
            onAgain={again}
          />
        ) : null}
      </div>

      {/* 手机端用固定底部 CTA 取代侧栏「今日」卡，保证首屏就能点到 */}
      {mobile ? (
        <div className="phone-dock">
          <button
            className="cta"
            onClick={spin}
            disabled={spinning || candidates.length === 0}
            aria-label={`抽取${mealNameOf(meal)}`}
          >
            {spinning ? '抽取中…' : '今天吃什么'}
          </button>
        </div>
      ) : (
        <div>
          <DayPanel date={todayStr()} compact />
        </div>
      )}
    </div>
  )
}
