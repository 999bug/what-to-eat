/**
 * SW 更新兜底横幅（极端情况才出现，常态渲染 null）。
 *
 * 主链路：SW 导航网络优先 + install 后立即 skipWaiting/clientsClaim 静默接管，
 * needRefresh 常态为 false。只有新 SW 意外卡在 waiting 时本横幅才出现：
 * 「立即更新」= updateServiceWorker(true)（新 SW 接管后自动 reload）。
 * 另加 10 秒保险丝：超时未点击则强制接管刷新，避免永远停在旧版。
 */
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** 横幅出现后的强制更新时限（保险丝） */
const FUSE_MS = 10_000

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // 挂载即布置保险丝：卡 waiting 的极端情况 10 秒后强制接管
  useEffect(() => {
    if (!needRefresh) return
    const timer = window.setTimeout(() => updateServiceWorker(true), FUSE_MS)
    return () => window.clearTimeout(timer)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null
  return (
    <div className="upd-banner" role="status">
      <span>新版本已就绪</span>
      <button onClick={() => updateServiceWorker(true)}>立即更新</button>
    </div>
  )
}
