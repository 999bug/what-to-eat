/** 统计页：菜系分布、三餐覆盖、每日热量趋势、本月之最（数字全部来自 lib/stats，保证与日历一致） */
import { useAppStore } from '@/stores/useAppStore'
import { activeMeals, monthRecords, monthStat } from '@/lib/stats'
import { cuisineName, mealName } from '@/data/meta'

export function StatsPage() {
  const month = useAppStore((s) => s.month)
  const records = useAppStore((s) => s.records)
  const midnight = useAppStore((s) => s.settings.midnight)

  const st = monthStat(records, month, midnight)
  const rs = monthRecords(records, month, midnight)

  const dishCount = new Map<string, number>()
  for (const r of rs) dishCount.set(r.dishName, (dishCount.get(r.dishName) ?? 0) + 1)
  const topDishes = [...dishCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const max = Math.max(1, ...st.daily)

  return (
    <div>
      <div className="card">
        <div className="card-t">本月菜系分布</div>
        {st.cuisines.length > 0 ? (
          st.cuisines.map((c) => (
            <div key={c.id} className="bar-row">
              <span className="nm">{cuisineName(c.id)}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: Math.round((c.n / st.cuisines[0].n) * 100) + '%' }}
                />
              </span>
              <span className="vl">{c.n} 次</span>
            </div>
          ))
        ) : (
          <div className="empty">本月还没有记录</div>
        )}
      </div>

      <div className="card">
        <div className="card-t">三餐覆盖</div>
        {activeMeals(midnight).map((m) => {
          const n = rs.filter((r) => r.meal === m).length
          return (
            <div key={m} className="bar-row">
              <span className="nm">{mealName(m)}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: Math.round((n / st.dim) * 100) + '%' }}
                />
              </span>
              <span className="vl">{n} 次</span>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-t">
          每日热量趋势
          <span className="more">日均 {st.avg} kcal</span>
        </div>
        <div className="spark">
          {st.daily.map((v, i) => (
            <span
              key={i}
              className={v === 0 ? 'zero' : ''}
              style={{ height: v === 0 ? 3 : Math.max(4, Math.round((v / max) * 100)) + '%' }}
              title={`${i + 1} 日 ${v} kcal`}
            />
          ))}
        </div>
        <div className="goal-line">
          横轴为本月 1–{st.dim} 日，未记录的日期不显示柱体（估算值，仅供参考）
        </div>
        {/*
          热量未知的记录不计入日均分母，所以日均是「按已知热量那天算的」。
          不提示的话用户会以为日均偏低，必须显式说明。
        */}
        {st.unknownCount > 0 ? (
          <div className="goal-line warn-line">
            另有 {st.unknownCount} 条记录（{st.unknownDays} 天）未填热量，已排除在日均之外
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-t">本月吃得最多</div>
        {topDishes.length > 0 ? (
          topDishes.map(([name, n]) => (
            <div key={name} className="item">
              <div className="body">
                <div className="t1">{name}</div>
              </div>
              <span className="kcal">{n} 次</span>
            </div>
          ))
        ) : (
          <div className="empty">暂无数据</div>
        )}
      </div>
    </div>
  )
}
