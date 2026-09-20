/**
 * 结果卡：同一份内容，按断点用两种容器呈现。
 * - 手机（<768）：底部 Sheet 从下推入，转盘仍露出一半，动线连续；支持下拉关闭
 * - 平板 / 桌面：沿用居中弹窗，不打扰既有布局
 * 口径：只读 store 的 result，写入一律走 acceptResult / nextCandidate / addRecord。
 */
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { cuisineName, levelDesc, levelName } from '@/data/meta'
import { isMobileWidth } from '@/lib/device'
import { haptics } from '@/lib/haptics'
import type { Dish } from '@/types'

interface ResultSheetProps {
  dish: Dish
  /** 收起（点遮罩、关闭、下拉关闭、或完成写入后由父级置为 false） */
  onClose: () => void
  /** 换一个：由父级驱动转盘/抽签桶动画 */
  onAgain: () => void
  /** 手机端是否展示为底部 Sheet */
  mobile: boolean
}

/** 下拉关闭阈值：拖过卡片高度的 30% 即关闭 */
const CLOSE_RATIO = 0.3

export function ResultSheet({ dish, onClose, onAgain, mobile }: ResultSheetProps) {
  const acceptResult = useAppStore((s) => s.acceptResult)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const openPick = useAppStore((s) => s.openPick)
  const meal = useAppStore((s) => s.meal)
  const showToast = useAppStore((s) => s.showToast)

  const cardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startY: 0, dy: 0, dragging: false })
  const [dy, setDy] = useState(0)
  /** 拖拽中关掉过渡，否则手指移动会跟 CSS 动画打架 */
  const [dragging, setDragging] = useState(false)

  // 抽出时给一次触觉确认（ResultSheet 挂载即代表「已出结果」）
  useEffect(() => {
    haptics.hit()
  }, [dish.id])

  const faved = favorites.includes(dish.id)

  /** 就吃这个：写入当天 + 当前餐次 */
  const accept = () => {
    haptics.tap()
    acceptResult()
    onClose()
  }

  /** 换一个：交由父级驱动动画 */
  const again = () => {
    haptics.tap()
    onAgain()
  }

  /** 记入其他餐次：关掉结果卡，打开补录面板 */
  const other = () => {
    haptics.tap()
    onClose()
    openPick(new Date().toISOString().slice(0, 10), meal)
  }

  const toggleFav = () => {
    haptics.tap()
    toggleFavorite(dish.id)
    showToast(faved ? '已取消收藏' : '已收藏，抽取时权重 ×1.5')
  }

  /* ---------- 手机：下拉关闭 ---------- */
  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, dy: 0, dragging: true }
    setDragging(true)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.dragging) return
    const d = e.touches[0].clientY - dragRef.current.startY
    // 只允许向下拖，且带阻尼
    dragRef.current.dy = d > 0 ? d : d * 0.2
    setDy(dragRef.current.dy)
  }
  const onTouchEnd = () => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    setDragging(false)
    const h = cardRef.current?.offsetHeight ?? 400
    if (dragRef.current.dy > h * CLOSE_RATIO) {
      haptics.tap()
      onClose()
    }
    setDy(0)
  }

  const body = (
    <>
      <div className="rname">
        {dish.icon} {dish.name}
        <span className="tagline">{cuisineName(dish.cuisines[0])}</span>
        {dish.custom ? <span className="tagline">我的</span> : null}
        <span className="lvl">{levelName(dish.level)}</span>
      </div>
      {dish.ingredients ? <div className="rmeta">食材：{dish.ingredients}</div> : null}
      <div className="ring">
        {dish.kcalKnown === false
          ? /* 自定义菜品未填热量：不要显示「约 0 kcal」，那会误导成没热量 */
            `热量未知（自己录的菜） · 难度${levelName(dish.level)}（${levelDesc(dish.level)}）`
          : `约 ${dish.kcal} kcal / 份（估算值） · 难度${levelName(dish.level)}（${levelDesc(dish.level)}）`}
      </div>
      <div className="acts">
        <button className="btn btn-primary" onClick={accept}>
          就吃这个
        </button>
        <button className="btn" onClick={again}>
          换一个
        </button>
        <button className="btn" onClick={other}>
          记入其他餐次
        </button>
        <button className={'btn btn-sm' + (faved ? ' on' : '')} onClick={toggleFav}>
          {faved ? '已收藏' : '收藏'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>
          关闭
        </button>
      </div>
    </>
  )

  if (!mobile) {
    return (
      <div className="rmask" onClick={onClose} role="dialog" aria-modal="true" aria-label="抽签结果">
        <div className="result" onClick={(e) => e.stopPropagation()}>
          {body}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rsheet-mask" onClick={onClose} role="presentation" />
      <div
        className="rsheet"
        role="dialog"
        aria-modal="true"
        aria-label="抽签结果"
        ref={cardRef}
        style={{
          transform: `translateY(${dy}px)`,
          transition: dragging ? 'none' : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="rsheet-grabber" aria-hidden="true" />
        <div className="result result-in-sheet">{body}</div>
      </div>
    </>
  )
}

/** 结果是否按移动端 Sheet 呈现（父级渲染前调用，避免 prop 里重复算） */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => isMobileWidth())
  useEffect(() => {
    const mq = window.matchMedia?.(`(max-width: ${767}px)`)
    if (!mq) return
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}
