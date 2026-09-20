# 项目进度与功能状态

> 记录 what-to-eat（今天吃什么）的实现状态、分层边界与口径约定，供后续开发（含 AI agent）接续。
> **最后更新：2026-09-20（版本 1.0.1）**——面向用户的版本摘要看 `src/changelog/changelogData.ts`（版本倒序）；
> 需求与竞品结论看 `docs/需求文档.md` / `docs/竞品调研.md`。
>
> **维护规则**：每完成一个功能/阶段必须同步更新本文档再提交；进行中的任务先登记到 §0，完成后移出。

---

## 0. 进行中任务清单（中断恢复必读）

| 状态 | 任务 | 进度 | 下一步 |
|---|---|---|---|
| ✅ 已完成 | **v1.0.0 正式版落地（Vite + React + TS）** | 数据层 / store / 四个页面 / 外壳主题 / 51 项测试全绿，`npm run check` 通过；配色改为暖米白 + 番茄红 | 无 |
| ✅ 已完成 | **GitHub 仓库与 Pages 上线** | 仓库名原为拼写错误的 `waht-to-eat`，已用 gh 改名为 `what-to-eat`（与 vite base 一致）；两个 commit 推送 main；Pages 以 Actions（build_type=workflow）启用，首次部署成功 | 线上：https://999bug.github.io/what-to-eat/ |
| ✅ 已完成 | **首页版本说明入口 + 新版本检测** | 首页顶部入口可看当前版本 / 完整更新日志 / 手动检查更新；线上有新版本时出现「点此刷新」；检测节奏对齐 cycling-analyzer（加载 + 每小时 + 切回标签页） | 无 |
| 📌 待办 | **菜库扩充到 300–400 道** | 当前 160 道（早餐 41 / 午餐 136 / 晚餐 128 / 夜宵 18） | 优先补早餐与夜宵（两端候选最少），集中在 `src/data/dishes.ts` |
| 📌 待办 | **热量值校准** | 现为常见食物成分表估算，取整到 10 kcal | 逐道核对后改 `src/data/dishes.ts` 即可，无需改逻辑 |
| ⏸️ 已暂缓 | **菜谱做法 / 一键下单** | 用户明确 v1 不做，只给菜名 + 所需食材 | 后续有需求再启动 |

---

## 1. 已完成功能

- **抽签**：餐次（早/午/晚/夜宵）自动按时间选中；菜系与口味为可选筛选（默认全菜库惊喜模式）；
  转盘（Canvas，5 圈 + ease-out cubic）与抽签桶两种玩法；结果卡给菜名 / 食材 / 热量估算 / 收藏 / 换一个 / 记入其他餐次。
- **抽取口径**（`src/lib/pool.ts`）：候选池 = 菜库 ∩ 餐次 ∩ 菜系 ∩ 口味 − 忌口；7 天内吃过 ×0.3（软降权），收藏 ×1.5，转盘候选最多 8 个。
- **记录**：抽中后「就吃这个」写入当天对应餐次；日历页可补录（搜索菜名或食材）或「抽一抽」就地抽取。
- **日历**：当月月历（周一起始、前后补空、今日高亮、每日餐次圆点与 kcal），点击任意一天看三餐与当日合计。
- **统计**：本月菜系分布、三餐覆盖、每日热量趋势（含日均）、本月吃得最多。
- **设置**：深浅/跟随系统主题、夜宵开关、智能去重、默认份量、忌口、每日热量目标、数据导出/导入/重置/清空、关于与更新日志。
- **示例数据**：mulberry32 固定种子 20260920 生成当月记录，首次进入不空白，且三处面板数字天然自洽。
- **结果呈现**：抽中后结果卡**居中浮层**弹出（不再落在页面底部），关闭后可从转盘下方「查看结果」再次打开；「换一个」会先收起浮层再重转转盘。
- **版本说明与更新提示**：首页顶部「版本说明」入口 → 当前版本 + 完整更新日志 + 手动检查更新；线上有新版本时首页出现「有新版本 · 点此刷新」。

---

## 2. 架构与接口约定（agent 工作须知）

### 分层（硬约束）

```
data（菜库/元数据/种子） → lib（纯函数：日期/抽取/统计/存储） → stores（zustand） → components/pages
```

- 组件**只调 store actions**，禁止直接写 `localStorage`、禁止在组件里各自 reduce 统计。
- 新增抽取或统计逻辑一律进 `src/lib/`，并补对应单测。
- 组件用 `function` 声明；`@/` 别名导入；注释中文、日志/异常消息英文。

### 口径单一来源

- **统计**：`src/lib/stats.ts` 是月统计、日热量、覆盖率、连续天数的唯一来源。
  日均 = 当月总热量 ÷ **已记录天数**（不是当月天数）；覆盖率 = 已记餐次 ÷（已记天数 × 启用餐位数）。
- **抽取**：`src/lib/pool.ts` 是候选池与权重的唯一来源。
- **版本检测**：`src/lib/version.ts`（`isNewer` / `fetchRemoteVersion`）是版本号比较与远端探测的唯一来源。
  `version.json` 由 `vite.config.ts` 的 `versionJsonPlugin` 在构建时写入产物根目录（dev 由中间件实时返回）；
  检测节奏在 `src/App.tsx` 的 `useUpdateWatch`：加载一次 + 每小时一次 + 切回标签页/聚焦一次（最小间隔 60s）。
  本项目**没有 Service Worker**，不做静默接管，提示用户刷新是取新版的唯一方式。
- **夜宵**：开关关闭时，已存的夜宵记录在日合计、月统计、覆盖率中一律不参与（数据保留，重开即回）。
  实现方式是 `recordsOn/dayKcal` 的可选 `meals` 参数 + `monthRecords()`，改这里请注意别漏掉某处。
- **热量**：估算值，取整到 10 kcal/份，UI 与设置页都必须带免责声明。

### 持久化

- localStorage，键前缀 `wte:v1:`（`src/lib/storage.ts`），三块数据：records / settings / favorites。
- 隐私：无后端、无账号、不上传；设置页数据区明确说明「清浏览器数据会丢，建议导出备份」。

### 视觉

- 配色：暖米白 `#F5F1EA` + 番茄红 `#D6453D`，深浅双主题通过 `[data-theme]` 切换（`src/theme.ts` 同步 `theme-color`）。
- 约束：不用渐变、不用纯白底、不外链资源（logo 为本地 asset）。
- 断点：<768 手机（底部 Tab） / ≥768 平板（图标侧栏） / ≥1200 桌面（双栏 + 侧栏文字）。

---

## 3. 测试约定

- Vitest + jsdom；`tests/setup.ts` 把 `HTMLCanvasElement.prototype.getContext` 打成返回 null（Wheel 内部已判空），避免 jsdom 告警刷屏。
- 覆盖：日期、菜库完整性、抽取口径、统计口径、示例数据确定性、更新日志与 `package.json` 版本同步、应用冒烟（真实挂载 App 跑导航与写入）。
- 组件渲染测试用 React 19 的 `act` + `createRoot`（`tests/app.smoke.test.tsx`），未引入 testing-library。

---

## 4. 代码规范与常用命令

- 提交信息：`[NF]`/`[BF]`/`[IM]`/`[CU]` + 中文 Subject + 要点 body；提交身份 `999bug <999bug@users.noreply.github.com>`。
- 提交前：`npm run check`（并行 tsc + eslint + vitest）。**本地不构建 dist**，由 CI 统一重建并部署到 GitHub Pages。
- 发版：先升 `package.json` 的 version，再在 `src/changelog/changelogData.ts` 头部追加同版本条目（有测试断言两者一致）。

```bash
npm run dev      # 本地开发
npm run check    # tsc + eslint + vitest（并行）
npm run test     # 仅测试
npm run lint     # 仅 ESLint
npm run build    # tsc -b + vite build（CI 用，本地可跳过）
```
