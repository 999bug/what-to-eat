/** 底部/居中弹层：筛选面板、补录面板、版本说明 */
import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { AVOID_META, CUISINES, LEVEL_META, TAG_META } from '@/data/meta'
import { DISHES } from '@/data/dishes'
import { mealName, levelName } from '@/data/meta'
import { CHANGELOG } from '@/changelog/changelogData'

export function SheetHost() {
  const sheet = useAppStore((s) => s.sheet)
  if (sheet === 'filters') return <FiltersSheet />
  if (sheet === 'pick') return <PickSheet />
  if (sheet === 'version') return <VersionSheet />
  return null
}

function FiltersSheet() {
  const filters = useAppStore((s) => s.filters)
  const avoid = useAppStore((s) => s.settings.avoid)
  const toggleCuisine = useAppStore((s) => s.toggleCuisine)
  const toggleTag = useAppStore((s) => s.toggleTag)
  const toggleLevel = useAppStore((s) => s.toggleLevel)
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
          <div className="lb">做菜难度（不选为不限）</div>
          <div className="chips wrap">
            {LEVEL_META.map((l) => (
              <button
                key={l.id}
                className={'chip' + (filters.levels.includes(l.id) ? ' on' : '')}
                onClick={() => toggleLevel(l.id)}
                title={l.desc}
              >
                {l.name}
                <small>{l.desc}</small>
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
              <span className="lvl">{levelName(d.level)}</span>
              <span className="kk">{d.kcal} kcal</span>
            </button>
          ))}
          {hits.length === 0 ? <div className="empty">没有匹配的菜</div> : null}
        </div>
      </div>
    </div>
  )
}

/** 版本说明：当前版本、更新检测结果、更新日志 */
function VersionSheet() {
  const closeSheet = useAppStore((s) => s.closeSheet)
  const updateVersion = useAppStore((s) => s.updateVersion)
  const checkUpdate = useAppStore((s) => s.checkUpdate)
  const applyUpdate = useAppStore((s) => s.applyUpdate)
  const showToast = useAppStore((s) => s.showToast)
  const [checking, setChecking] = useState(false)

  /** 手动检查：结果以 toast 回报，检测不到/离线都视为「已是最新」 */
  const onCheck = async () => {
    setChecking(true)
    await checkUpdate()
    setChecking(false)
    const found = useAppStore.getState().updateVersion
    showToast(found ? `线上已有新版本 v${found}，可刷新更新` : '已是最新版本')
  }

  return (
    <div className="sheet-mask" onClick={closeSheet}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>版本说明</h3>
          <button className="btn btn-sm btn-ghost" onClick={closeSheet}>
            关闭
          </button>
        </div>

        <div className="sheet-sec">
          <div className="lb">当前版本</div>
          <div className="ver-line">v{__APP_VERSION__}</div>
          {updateVersion ? (
            <div className="upd">
              <span>线上已有新版本 v{updateVersion}</span>
              <button className="btn btn-sm btn-primary" onClick={applyUpdate}>
                刷新更新
              </button>
            </div>
          ) : null}
          <div className="row-acts">
            <button className="btn btn-sm" onClick={onCheck} disabled={checking}>
              {checking ? '检查中…' : '检查更新'}
            </button>
          </div>
          <p className="note">
            更新只是刷新页面取回新版页面文件，记录仍保存在本设备浏览器中，不受影响。
          </p>
        </div>

        <div className="sheet-sec">
          <div className="lb">更新日志</div>
          <div className="changelog">
            {CHANGELOG.map((e) => (
              <div key={e.version} className="cl-item">
                <div className="cl-head">
                  <b>v{e.version}</b>
                  <span>{e.date}</span>
                  {e.version === __APP_VERSION__ ? <span className="cur">当前</span> : null}
                </div>
                <ul>
                  {e.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
