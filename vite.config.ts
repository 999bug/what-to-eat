import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// 应用版本号（取自 package.json，define 注入供侧栏与更新日志页显示）
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * 产出 version.json：前端据此判断线上是否有新版本。
 * dev 用中间件实时返回（始终等于当前 package.json）；build 时写入产物根目录。
 */
function versionJsonPlugin(): Plugin {
  const payload = () =>
    JSON.stringify({ version: pkg.version, updatedAt: new Date().toISOString() }, null, 2) + '\n'

  return {
    name: 'wte-version-json',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(payload())
      })
    },
    closeBundle() {
      const out = resolve(process.cwd(), 'dist')
      mkdirSync(out, { recursive: true })
      writeFileSync(resolve(out, 'version.json'), payload(), 'utf8')
    },
  }
}

export default defineConfig(({ command }) => {
  // 生产构建用绝对 base：仓库部署在 GitHub Pages 子路径 /what-to-eat/；
  // 本项目无路由深链需求，base 只影响静态资源前缀
  const base = command === 'build' ? '/what-to-eat/' : '/'

  return {
    base,
    plugins: [react(), versionJsonPlugin()],
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
