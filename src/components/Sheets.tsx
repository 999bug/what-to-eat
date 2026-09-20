/** 底部/居中弹层：筛选面板与补录面板 */
import { useAppStore } from '@/stores/useAppStore'
import { AVOID_META, CUISINES, TAG_META } from '@/data/meta'
import { DISHES } from '@/data/dishes'
import { mealName } from '@/data/meta'

export function SheetHost() {
  const sheet = useAppStore((s) => s.sheet)
  if (sheet === 'filters') return <FiltersSheet />
  if (sheet === 'pick') return <PickSheet />
  return null
}

function FiltersSheet() {
  const filters = useAppStore((s) => s.filters)
  const avoid = useAppStore((s) => s.settings.avoid)
  const toggleCuisine = useAppStore((s) => s.toggleCuisine)
  const toggleTag = useAppStore((s) => s.toggleTag)
  const toggleAvoid = useAppStore((s) => s.toggleAvoid)
  const clearFilters = useAppStore((s) => s.clearFilters)
  const closeSheet = useAppStore((s) => s.closeSheet)

  return (
    <div className="sheet-mask" onClick={closeSheet}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>筛选条件</h3>
          <button className="btn btn-sm btn-ghost" onClick={closeSheet}>
            完成
          </button>
        </div>

        <div className="sheet-sec">
          <div className="lb">菜系（可多选，不选为全部）</div>
          <div className="chips wrap">
            {CUISINES.map((c) => (
              <button
                key={c.id}
                className={'chip' + (filters.cuisines.includes(c.id) ? ' on' : '')}
                onClick={() => toggleCuisine(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-sec">
          <div className="lb">口味与场景</div>
          <div className="chips wrap">
            {TAG_META.map((t) => (
              <button
                key={t.id}
                className={'chip' + (filters.tags.includes(t.id) ? ' on' : '')}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-sec">
          <div className="lb">忌口（长期生效，写入设置）</div>
          <div className="chips wrap">
            {AVOID_META.map((a) => (
              <button
                key={a.id}
                className={'chip' + (avoid.includes(a.id) ? ' on' : '')}
                onClick={() => toggleAvoid(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row-acts wide">
          <button className="btn btn-block" onClick={clearFilters}>
            重置筛选
          </button>
          <button className="btn btn-primary btn-block" onClick={closeSheet}>
            应用
          </button>
        </div>
      </div>
    </div>
  )
}

function PickSheet() {
  const pickMeal = useAppStore((s) => s.pickMeal)
  const pickQuery = useAppStore((s) => s.pickQuery)
  const setPickQuery = useAppStore((s) => s.setPickQuery)
  const closeSheet = useAppStore((s) => s.closeSheet)
  const addRecord = useAppStore((s) => s.addRecord)
  const pickDate = useAppStore((s) => s.pickDate)

  const q = pickQuery.trim()
  const hits = DISHES.filter(
    (d) => d.meals.includes(pickMeal) && (q === '' || d.haystack.includes(q)),
  ).slice(0, 60)

  return (
    <div className="sheet-mask" onClick={closeSheet}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>补录 · {mealName(pickMeal)}</h3>
          <button className="btn btn-sm btn-ghost" onClick={closeSheet}>
            关闭
          </button>
        </div>
        <input
          className="search"
          placeholder="搜索菜名或食材"
          value={pickQuery}
          onChange={(e) => setPickQuery(e.target.value)}
          autoFocus
        />
        <div className="dish-list">
          {hits.map((d) => (
            <button
              key={d.id}
              className="dish-hit"
              onClick={() => {
                addRecord(d, pickDate, pickMeal, 'manual')
                closeSheet()
              }}
            >
              <span className="ico">{d.icon}</span>
              <span className="nm">{d.name}</span>
              <span className="kk">{d.kcal} kcal</span>
            </button>
          ))}
          {hits.length === 0 ? <div className="empty">没有匹配的菜</div> : null}
        </div>
      </div>
    </div>
  )
}
