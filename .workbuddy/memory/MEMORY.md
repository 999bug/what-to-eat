# what-to-eat 项目长期约定

> 跨会话沉淀。日常操作写 `YYYY-MM-DD.md`，这里只放「每次都必须遵守 / 每次都会踩」的硬约定。

## 分层架构（硬约束）

`data（菜库/元数据/种子） → lib（纯函数：日期/抽取/统计/存储/版本） → stores（zustand） → components/pages`

- 组件**只**调 store actions；**禁止**在组件里直接读写 localStorage。
- 统计口径唯一来源 `src/lib/stats.ts`；抽取口径唯一来源 `src/lib/pool.ts`。**禁止**在页面里各自 reduce。
- 日均 = 当月总热量 ÷ 已记录天数；`kcalKnown === false` 的记录不计入分母。

## 响应式断点（改一处必须同步另一处）

`<768` 手机（底部 Tab + `.phone-dock` 固定 CTA）/ `≥768` 平板（76px 图标侧栏）/ `≥1200` 桌面（200px 带字侧栏 + 双栏）。

- 数值定义在 `src/lib/device.ts`（`MOBILE_BREAKPOINT = 768`）与 `src/index.css` 的 `@media`，**两处必须一致**。
- `useMobile()` 用 `isMobileWidth()` 读 `window.innerWidth` 作**初值**，监听只是后续更新——
  测试里要模拟手机必须**挂载前**改 `window.innerWidth`（jsdom 默认 1024），光设 `__matchMediaMatches` 不够。

## 样式硬约束

- 配色 token 优先：`var(--accent)` / `var(--surface-2)` / `var(--text-2)` …，**禁止**写死颜色。
- **不用渐变、不用纯白底、不外链字体/图片**。深色主题用 `[data-theme='dark']` 覆写，新增配色必须两个主题都覆盖。
- 动效只许动画 `transform` 与 `opacity`，0.2–0.3s；新增动效必须进 `@media (prefers-reduced-motion: reduce)` 降级块。
- 触控热区 ≥44×44；无障碍按 WCAG AA（正文 4.5:1，UI 组件 3:1）。

## 测试环境（大坑，务必先读）

- 测试栈：Vitest + jsdom，**React 19 的 `act` + `createRoot`**（`tests/app.smoke.test.tsx` 是范式）。**未装** testing-library，别 import。
- **jsdom 不加载 `index.css`**：`getComputedStyle` 拿不到样式表结果，`::before` 伪元素返回空，`writing-mode` 退化为 `horizontal-tb`。
  **不要用计算样式断言视觉**，会误判成 bug。
  正确做法：读 `src/index.css` 源码断言声明值（见 `tests/scrollGuard.test.ts` / `tests/lotVisual.test.tsx` 里的 `blockOf`/`declOf`/`bgOf`）。
  ⚠️ 断言前**必须去掉 CSS 注释**（`/\*[\s\S]*?\*\//g`），否则注释里提到的属性名会被误计为真实声明。
  真要看视觉用真实浏览器截图。
- **抽取相关测试禁止概率断言**：`candidates` 是「8 个加权随机 + 去重」，别 `candidates.find(名字)` 断言非空，也别循环刷新 60 次。
  要确定性断言就用 store 导出的纯函数 `poolOf(state)` 查成员资格。
- 种子数据必须**确定性**（mulberry32 固定种子），且跨面板数字自洽。

## 本机环境备忘

- node 用托管版（`<managed-node>/node.exe`，勿用系统 nvm 那份）；Pillow 在托管 Python 里可直接 import，无需建 venv。
- **`vite preview` 只监听 IPv6**：访问用 `http://[::1]:port`，用 `localhost` 会拿到 502。
- `playwright-cli` 的 node_modules 是空的、`playwright` 包不存在；`~/.cache` 里的 Chromium headless shell 可直接截图。

## 版本与交付

- 发版流程：先改 `package.json` 的 `version` → 再在 `src/changelog/changelogData.ts` **头部**追加同版本条目（`tests/changelog.test.ts` 强制同步）。
- `docs/PROGRESS.md` 必须随功能阶段同步更新（§0 登记进行中任务）。
- 验收命令：`npm run check`（= `tsc -b` + `eslint` + `vitest`）。
- 交付前**清理探针文件与后台预览服务器**（用户明确要求，不留悬空进程占端口）。
