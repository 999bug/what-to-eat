/** 日期纯函数：一律本地时区 + 本地日期字符串（YYYY-MM-DD），不做跨时区换算 */

export const pad = (n: number): string => (n < 10 ? '0' + n : String(n))

/** Date → 本地日期字符串 YYYY-MM-DD */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 本地日期字符串 → Date（当天零点） */
export const parseYmd = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayStr = (): string => ymd(new Date())

/** 月份片段 YYYY-MM */
export const monthOf = (date: string): string => date.slice(0, 7)

/** 相差天数（取绝对值） */
export const daysBetween = (a: string, b: string): number =>
  Math.abs((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000)

/** 某月天数（自动处理闰年） */
export const daysInMonth = (ym: string): number => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** 月份平移（delta 可为负），返回 YYYY-MM */
export const addMonths = (ym: string, delta: number): string => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 日期展示：9月20日 周日 */
export const prettyDate = (date: string): string => {
  const d = parseYmd(date)
  const week = ['一', '二', '三', '四', '五', '六', '日'][(d.getDay() + 6) % 7]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`
}
