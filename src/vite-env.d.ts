/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
// virtual:pwa-register/react 的模块声明在 react 入口里，client 不包含（否则 tsc 报 TS2307）
/// <reference types="vite-plugin-pwa/react" />

/** 应用版本号（vite.config.ts define 注入，取自 package.json） */
declare const __APP_VERSION__: string
