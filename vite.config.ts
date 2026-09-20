import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 应用版本号（取自 package.json，define 注入供侧栏与更新日志页显示）
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig(({ command }) => {
  // 生产构建用绝对 base：仓库部署在 GitHub Pages 子路径 /what-to-eat/；
  // 本项目无路由深链需求，base 只影响静态资源前缀
  const base = command === 'build' ? '/what-to-eat/' : '/'

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['tests/setup.ts'],
      globals: false,
    },
  }
})
