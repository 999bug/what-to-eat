/** 当天三餐面板：按餐次分组列出记录，支持补录 / 就地抽一抽 / 删除（compact 模式隐藏操作，用于抽签页侧栏） */
import { useAppStore } from '@/stores/useAppStore'
import { activeMeals, dayKcal, recordsOn, unknownCountOn } from '@/lib/stats'
import { prettyDate } from '@/lib/date'
import { cuisineName, MEALS, mealName } from '@/data/meta'

interface DayPanelProps {
  date: string
  /** 抽签页侧栏的「今日」精简模式：隐藏补录与删除 */
  compact?: boolean
}

export function DayPanel({ date, compact = false }: DayPanelProps) {
  const records = useAppStore((s) => s.records)
  const midnight = useAppStore((s) => s.settings.midnight)
  const goalOn = useAppStore((s) => s.settings.goalOn)
  const goal = useAppStore((s) => s.settings.goal)
  const openPick = useAppStore((s) => s.openPick)
  const drawFor = useAppStore((s) => s.drawFor)
  const deleteRecord = useAppStore((s) => s.deleteRecord)

  const meals = activeMeals(midnight)

  const rs = recordsOn(records, date, meals)
  const total = dayKcal(records, date, meals)
  const unknown = unknownCountOn(records, date, meals)

  return (
    <div className="card">
      <div className="card-t">
        {prettyDate(date)}
        {compact ? <span className="more">今日</span> : null}
      </div>

      {goalOn ? (
        <div className="bar-row">
          <span className="nm">热量</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: Math.min(100, Math.round((total / goal) * 100)) + '%' }}
            />
          </span>
          <span className="vl">
            {total}/{goal}
          </span>
        </div>
      ) : (
        <div className="hint left">
          当日合计 {total} kcal（估算）
          {/* 有未填热量的记录时，合计只代表已知部分，必须说明 */}
          {unknown > 0 ? `，另有 ${unknown} 条未填热量` : ''}
        </div>
      )}

      <div className="day-groups">
        {MEALS.filter((m) => meals.includes(m.id)).map((m) => {
          const list = rs.filter((r) => r.meal === m.id)
          const sum = list.reduce((s, r) => s + r.kcal, 0)
          const unk = list.filter((r) => r.kcalKnown === false).length
          return (
            <div key={m.id} className="meal-group">
              <div className="meal-head">
                <span className="n">{mealName(m.id)}</span>
                <span>{list.length > 0 ? (unk > 0 ? `${sum} kcal +${unk} 未知` : sum + ' kcal') : ''}</span>
              </div>
              {list.length === 0 ? (
                <div className="empty">未记录</div>
              ) : (
                list.map((r) => (
                  <div key={r.id} className="item">
                    <span className="ico">{r.icon}</span>
                    <div className="body">
                      <div className="t1">{r.dishName}</div>
                      <div className="t2">
                        {cuisineName(r.cuisine)} · {r.servings} 份
                      </div>
                    </div>
                    <span className="kcal">
                      {r.kcalKnown === false ? '热量未知' : `${r.kcal} kcal`}
                    </span>
                    {compact ? null : (
                      <button
                        className="del"
                        onClick={() => deleteRecord(r.id)}
                        aria-label={'删除 ' + r.dishName}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))
              )}
              {compact ? null : (
                <div className="row-acts">
                  <button className="btn btn-sm" onClick={() => openPick(date, m.id)}>
                    + 补录
                  </button>
                  <button className="btn btn-sm" onClick={() => drawFor(date, m.id)}>
                    抽一抽
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
