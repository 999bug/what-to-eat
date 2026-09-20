/**
 * 左下角版本说明入口（全局常驻）。
 *
 * 交互设计：
 * - 平板 / 桌面（≥768px）：侧栏底部常驻，显示 `v1.0.1 · 版本说明` + 「查看更新日志」。
 * - 手机（<768px）：**默认收起成一个小胶囊**，只露版本号，不抢首屏视线；
 *   点一下展开，露出「版本说明」与「查看更新日志」，再点收起。
 * - 检测到线上有新版本时，额外顶出一条可一键刷新的提示（不取代版本号本身）。
 *
 * 为什么放侧栏底部而不是页面里：版本号是「低频查看、长期存在」的元信息，
 * 放页面里会随滚动消失，做固定角标又容易误触。侧栏底部是天然的元信息位。
 */
import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export function VersionNote() {
  const openVersion = useAppStore((s) => s.openVersion)
  const updateVersion = useAppStore((s) => s.updateVersion)
  const applyUpdate = useAppStore((s) => s.applyUpdate)
  /** 手机端展开态；平板/桌面恒展开 */
  const [open, setOpen] = useState(false)

  return (
    <div className={'vernote' + (open ? ' open' : '') + (updateVersion ? ' has-upd' : '')}>
      <button
        className="vernote-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? '收起版本说明' : '展开版本说明'}
      >
        <span className="vernote-ver">v{__APP_VERSION__}</span>
        <span className="vernote-lab">版本说明</span>
      </button>

      <button className="vernote-open" onClick={openVersion}>
        查看更新日志
      </button>

      {/* 有新版本时才出现，且不挤掉版本号本身 */}
      {updateVersion ? (
        <button className="vernote-upd" onClick={applyUpdate}>
          新版本 v{updateVersion} · 刷新
        </button>
      ) : null}
    </div>
  )
}
