/**
 * Canvas 转盘。
 * 交互契约：父组件经 ref 调 spin()，动画结束回调 onFinish(中选菜)；
 * 旋转状态走 ref（不进 React 状态），避免 60fps 重渲染。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { Dish } from '@/types'

export interface WheelHandle {
  spin: () => void
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
    spin: () => {
      const n = items.length
      if (n === 0) return
      const idx = Math.floor(Math.random() * n)
      const step = TAU / n
      // 终止角：中选扇区中心对准顶部指针（-PI/2），并叠加整圈数
      const desired = -(idx * step + step / 2)
      const cur = rotRef.current
      const delta = (((desired - cur) % TAU) + TAU) % TAU
      const target = cur + SPIN_TURNS * TAU + delta
      const t0 = performance.now()

      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / SPIN_MS)
        const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
        rotRef.current = cur + (target - cur) * eased
        draw()
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
