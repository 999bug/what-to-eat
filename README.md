# what-to-eat · 今天吃什么

解决「今天吃什么」的纯前端随机选菜工具：抽签决定菜品 → 一键记入三餐 → 月历回看 → 热量估算。
手机 / 平板 / 桌面响应式，无后端、无账号，数据全部保存在本地浏览器。

- 线上地址（GitHub Pages）：仓库开启 Pages 后访问 `https://999bug.github.io/what-to-eat/`
- 本地预览：`npm install && npm run dev`

## 文档

| 文件 | 内容 |
|---|---|
| [docs/需求文档.md](./docs/需求文档.md) | PRD v1.0：功能需求、数据规格、交互流程、响应式规范、技术方案、验收标准、正式版实现清单 |
| [docs/竞品调研.md](./docs/竞品调研.md) | 8 类同类产品调研（小程序 / App / 开源 Web / 饮食记录类），差异化定位与机会点 |
| [docs/PROGRESS.md](./docs/PROGRESS.md) | 项目进度、架构与口径约定、测试与提交规范（开发前先读） |

## 原型与正式版

- `prototype/` 是**评审用原型**（免构建，双击 `app.html` 即可打开），已冻结，不再随正式版演进。
- `src/` 是**正式版**：Vite + React 19 + TypeScript + zustand，配色暖米白 `#F5F1EA` + 番茄红 `#D6453D`。

已确认范围：**v1 只给菜名 + 所需食材，不做菜谱做法**；**夜宵 v1 就做，设置里默认关闭**。

## 技术栈与分层

```
data（菜库/元数据/种子） → lib（日期/抽取/统计/存储 纯函数） → stores（zustand） → components/pages
```

- 抽取口径集中在 `src/lib/pool.ts`（7 天内吃过 ×0.3、收藏 ×1.5、忌口硬过滤、转盘候选 8 个）。
- 统计口径集中在 `src/lib/stats.ts`（日均按已记录天数算，不按当月天数）。
- 组件只调 store actions，不直接碰 localStorage。

## 状态

- [x] 竞品调研
- [x] 需求文档 v1.0
- [x] 交互原型（160 道菜库，26 项 jsdom 冒烟检查通过）
- [x] 正式版 v1.0.0（抽签 / 日历 / 统计 / 设置，53 项测试 + lint + tsc 全绿）
- [x] 推送 GitHub 并开启 Pages（https://999bug.github.io/what-to-eat/）
- [ ] 菜库扩充到 300–400 道（优先补早餐与夜宵）

## 核心结论速览

- **关键决策**：菜系**不强制**前置选择，改为「默认全菜库随机（惊喜模式）+ 菜系作为可选筛选」的双入口。
- **差异化**：市面「随机决策类」与「饮食记录类」互不打通，本产品补的是「抽 → 记 → 看」这条闭环。
- **数据**：localStorage（前缀 `wte:v1:`），支持导出/导入备份；热量为估算值，取整到 10 kcal/份。

## 常用命令

```bash
npm run dev      # 本地开发
npm run check    # tsc + eslint + vitest（并行，提交前必跑）
npm run test     # 仅测试
npm run build    # 生产构建（CI 用，本地可跳过）
```
