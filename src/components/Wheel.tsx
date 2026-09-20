/**
 * Canvas 转盘。
 * 交互契约：父组件经 ref 调 spin()，动画结束回调 onFinish(中选菜)；
 * 旋转状态走 ref（不进 React 状态），避免 60fps 重渲染。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { Dish } from '@/types'
import { prefersReducedMotion } from '@/lib/device'
import { haptics } from '@/lib/haptics'

export interface WheelHandle {
  /** 转动；传入 targetId 时转到指定那道菜（「换一个」用），不传则随机 */
  spin: (targetId?: string) => void
}

interface WheelProps {
  items: Dish[]
  onFinish: (dish: Dish) => void
}

/** 扇区配色：番茄红单色系深浅阶梯（亮暗两主题下都可读） */
const WHEEL_COLORS = ['#D6453D', '#B93A33', '#E06A5B', '#A02E28', '#E88A73', '#8A2722', '#F0AC98', '#701D19']

const TAU = Math.PI * 2
const SPIN_TURNS = 5 // 至少转满 5 圈
const SPIN_MS = 2800
/** 减弱动态效果时的降级参数 */
const SPIN_TURNS_REDUCED = 1
const SPIN_MS_REDUCED = 800

export const Wheel = forwardRef<WheelHandle, WheelProps>(function Wheel({ items, onFinish }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotRef = useRef(0)
  const rafRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const cx = w / 2
    const r = w / 2 - 10
    ctx.clearRect(0, 0, w, w)
    if (items.length === 0) return

    const n = items.length
    const step = TAU / n
    items.forEach((it, i) => {
      const a0 = -Math.PI / 2 + rotRef.current + i * step
      ctx.beginPath()
      ctx.moveTo(cx, cx)
      ctx.arc(cx, cx, r, a0, a0 + step)
      ctx.closePath()
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.28)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.save()
      ctx.translate(cx, cx)
      ctx.rotate(a0 + step / 2)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.font = '500 26px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.fillText(it.name.length > 7 ? it.name.slice(0, 7) : it.name, r - 26, 0)
      ctx.restore()
    })

    // 中心按钮
    ctx.beginPath()
    ctx.arc(cx, cx, 54, 0, TAU)
    ctx.fillStyle = '#2B2622'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.16)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#F5F1EA'
    ctx.font = '600 26px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('开抽', cx, cx)
  }, [items])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  useImperativeHandle(ref, () => ({
    spin: (targetId?: string) => {
      const n = items.length
      if (n === 0) return
      const wanted = targetId ? items.findIndex((d) => d.id === targetId) : -1
      const idx = wanted >= 0 ? wanted : Math.floor(Math.random() * n)
      const step = TAU / n
      // 终止角：中选扇区中心对准顶部指针（-PI/2），并叠加整圈数
      const desired = -(idx * step + step / 2)
      const cur = rotRef.current
      const delta = (((desired - cur) % TAU) + TAU) % TAU
      // 系统开启「减弱动态效果」时只转 1 圈、时长缩短
      const reduced = prefersReducedMotion()
      const turns = reduced ? SPIN_TURNS_REDUCED : SPIN_TURNS
      const dur = reduced ? SPIN_MS_REDUCED : SPIN_MS
      const target = cur + turns * TAU + delta
      const t0 = performance.now()
      let lastSector = -1

      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
        rotRef.current = cur + (target - cur) * eased
        draw()
        // 每跨过一个扇区边界给一次极短触觉，模拟转盘的「咔哒」感；
        // 接近停止时（p > 0.92）不再震动，避免末尾连震
        const sector = Math.floor((rotRef.current - cur) / step)
        if (sector !== lastSector) {
          lastSector = sector
          if (p < 0.92) haptics.tick()
        }
        if (p < 1) {
          rafRef.current = requestAnimationFrame(frame)
        } else {
          onFinish(items[idx])
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    },
  }))

  return (
    <div className="wheel-stage">
      <canvas ref={canvasRef} id="wheel" width={640} height={640} />
      <div className="pin" />
    </div>
  )
})
