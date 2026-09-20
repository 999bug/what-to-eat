/** 月历：7 列网格（周一为首列），格内三点表示早/午/晚（开夜宵为四点）记录状态 */
import { useAppStore } from '@/stores/useAppStore'
import { activeMeals, dayKcal, recordsOn } from '@/lib/stats'
import { pad, todayStr } from '@/lib/date'
import { MEALS } from '@/data/meta'

const DOW = ['一', '二', '三', '四', '五', '六', '日']

/** 某月的日期格（含首尾补位 null，总长为 7 的倍数） */
function monthCells(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7 // 周一为首列
  const dim = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= dim; d++) cells.push(`${ym}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function MonthCalendar() {
  const month = useAppStore((s) => s.month)
  const selDate = useAppStore((s) => s.selDate)
  const records = useAppStore((s) => s.records)
  const midnight = useAppStore((s) => s.settings.midnight)
  const setSelDate = useAppStore((s) => s.setSelDate)
  const shiftMonth = useAppStore((s) => s.shiftMonth)
  const goThisMonth = useAppStore((s) => s.goThisMonth)

  const [y, m] = month.split('-')
  const meals = activeMeals(midnight)

  return (
    <div className="card">
      <div className="cal-head">
        <div className="m">
          {y} 年 {Number(m)} 月
        </div>
        <div className="cal-nav">
          <button data-act="prev-month" onClick={() => shiftMonth(-1)} aria-label="上一月">
            ‹
          </button>
          <button data-act="this-month" onClick={goThisMonth} aria-label="回到今天">
            今
          </button>
          <button data-act="next-month" onClick={() => shiftMonth(1)} aria-label="下一月">
            ›
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {monthCells(month).map((date, i) => {
          if (!date) return <div key={'x' + i} />
          const rs = recordsOn(records, date)
          const dots = meals.map((meal) => (
            <span
              key={meal}
              className={'dot' + (rs.some((r) => r.meal === meal) ? ' on' : '')}
            />
          ))
          const cls =
            'cal-cell' +
            (date === selDate ? ' sel' : '') +
            (date === todayStr() ? ' today' : '')
          return (
            <button key={date} className={cls} onClick={() => setSelDate(date)}>
              <span className="d">{Number(date.slice(8))}</span>
              <span className="dots">{dots}</span>
              <span className="kc">{rs.length > 0 ? dayKcal(records, date) : ''}</span>
            </button>
          )
        })}
      </div>

      <div className="hint left">
        格内{meals.length}个点依次代表{MEALS.filter((x) => meals.includes(x.id)).map((x) => x.name).join(' / ')}
        ，实心为已记录
      </div>
    </div>
  )
}
