/** 入口：挂载 React 应用（全局样式在本文件引入，构建时由 Vite 抽取） */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root 不存在，index.html 可能被改动')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
