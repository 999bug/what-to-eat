/**
 * 版本更新日志数据。
 * 每发布一个新版本，在数组头部追加一条（版本倒序展示）；
 * 页面读取 __APP_VERSION__ 高亮当前版本，tests/changelog 保证头部条目与 package.json 同步。
 */

export interface ChangelogEntry {
  /** 版本号（如 '1.0.0'） */
  version: string
  /** 发布日期（YYYY-MM-DD） */
  date: string
  /** 该版本新增/变更功能（面向用户的简短描述） */
  features: readonly string[]
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-09-20',
    features: [
      '正式版第一发：160 道内置菜库（八大菜系 + 地方菜 + 家常菜 + 外国菜），按餐次过滤',
      '转盘 / 抽签桶两种抽取玩法，菜系、口味场景、忌口多维筛选，7 天内吃过的自动降权',
      '结果一键记入当天三餐，月历按天回看早/午/晚（夜宵可在设置开启），支持补录与就地抽取',
      '热量估算贯穿全程：菜品标注单份热量、日合计、月趋势，可选每日目标',
      '设置页支持主题、默认份量、忌口、数据导出/导入，示例数据一键重置',
      '手机 / 平板 / 桌面三端响应式，数据全部保存在本机浏览器',
    ],
  },
]
