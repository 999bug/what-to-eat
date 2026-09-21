/** 入口：挂载 React 应用（全局样式在本文件引入，构建时由 Vite 抽取） */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/index.css'

/** 发版兜底标记 key（防循环刷新） */
const PRELOAD_RELOADED_KEY = 'what-to-eat:preloadReloaded'

// 发版兜底：部署更新后，旧页面引用的哈希 chunk 已在服务器删除，
// 动态 import 会 404 报 "Failed to fetch dynamically imported module"。
// 监听 Vite 预加载错误，自动刷新一次加载最新版（会话标记防循环刷新）。
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem(PRELOAD_RELOADED_KEY)) {
    sessionStorage.setItem(PRELOAD_RELOADED_KEY, '1')
    window.location.reload()
  }
})
// 应用正常加载完成后清除标记：本次会话后续发版仍可触发一次自动恢复
window.setTimeout(() => sessionStorage.removeItem(PRELOAD_RELOADED_KEY), 10_000)

const root = document.getElementById('root')
if (!root) throw new Error('#root 不存在，index.html 可能被改动')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
