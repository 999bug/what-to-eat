/** 日历页：月历 + 月概览 + 选中日期的三餐面板 */
import { MonthCalendar } from '@/components/MonthCalendar'
import { DayPanel } from '@/components/DayPanel'
import { useAppStore } from '@/stores/useAppStore'
import { monthStat } from '@/lib/stats'
import { CUISINES, cuisineName } from '@/data/meta'

export function CalendarPage() {
  const month = useAppStore((s) => s.month)
  const selDate = useAppStore((s) => s.selDate)
  const records = useAppStore((s) => s.records)
  const midnight = useAppStore((s) => s.settings.midnight)

  const st = monthStat(records, month, midnight)
  const top = st.cuisines.slice(0, 5)

  return (
    <div className="split-cal">
      <div>
        <MonthCalendar />

        <div className="card">
          <div className="card-t">本月概览</div>
          <div className="stat-row">
            <div className="stat">
              <div className="v">{st.days}</div>
              <div className="l">已记录天数</div>
            </div>
            <div className="stat">
              <div className="v">{st.avg}</div>
              <div className="l">日均 kcal</div>
            </div>            <div className="stat">
              <div className="v">{st.cover}%</div>
              <div className="l">三餐覆盖率</div>
            </div>
            <div className="stat">
              <div className="v">{st.streak}</div>
              <div className="l">连续天数</div>
            </div>
          </div>
          <div className="mt">
            {top.length > 0 ? (
              top.map((c) => (
                <div key={c.id} className="bar-row">
                  <span className="nm">{cuisineName(c.id)}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: Math.round((c.n / top[0].n) * 100) + '%' }}
                    />
                  </span>
                  <span className="vl">{c.n} 次</span>
                </div>
              ))
            ) : (
              <div className="empty">本月还没有记录</div>
            )}
          </div>
          {/* 有未填热量的记录时，日均只反映已知部分，要说明清楚 */}
          {st.unknownCount > 0 ? (
            <div className="goal-line warn-line">
              另有 {st.unknownCount} 条记录（{st.unknownDays} 天）未填热量，未计入日均
            </div>
          ) : null}
        </div>

        <div className="hint">
          菜系图标含义：{CUISINES.slice(0, 4).map((c) => c.name).join('、')} 等 12 个分组，一道菜可同时属于多个分组
        </div>
      </div>

      <div>
        <DayPanel date={selDate} />
      </div>
    </div>
  )
}
