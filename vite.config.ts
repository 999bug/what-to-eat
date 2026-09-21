import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
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
    plugins: [
      react(),
      versionJsonPlugin(),
      // PWA：静默自动更新（导航网络优先见 src/sw.ts）——刷新一次必得最新版
      VitePWA({
        registerType: 'autoUpdate',
        // 自定义 SW：插件定位 src/sw.ts 源码，编译后由 workbox-build 注入预缓存清单
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: ['logo.png'],
        manifest: {
          name: '今天吃什么',
          short_name: '今天吃什么',
          lang: 'zh-CN',
          theme_color: '#F5F1EA',
          background_color: '#F5F1EA',
          display: 'standalone',
          start_url: `${base}`,
          scope: `${base}`,
          // sizes 必须与 public/logo.png 的真实像素一致：声明的尺寸大于实际文件时，
          // 部分平台会因「声明与实物不符」拒绝该图标而回退成通用灰图标
          icons: [{ src: 'logo.png', sizes: '256x256', type: 'image/png', purpose: 'any' }],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // version.json 由 versionJsonPlugin 在构建收尾写入、须保持最新，
          // 绝不能进预缓存（否则发版后前端永远读到旧版本号）
          globIgnores: ['**/version.json'],
        },
      }),
    ],
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
