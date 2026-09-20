/** 设置页：主题 / 抽签偏好 / 忌口 / 热量目标 / 数据管理 / 关于 */
import { useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { AVOID_META } from '@/data/meta'
import { CHANGELOG } from '@/changelog/changelogData'
import { MyDishesCard } from '@/components/MyDishes'
import logoUrl from '@/assets/logo.png'

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings)
  const toggleSetting = useAppStore((s) => s.toggleSetting)
  const updateSetting = useAppStore((s) => s.updateSetting)
  const toggleAvoid = useAppStore((s) => s.toggleAvoid)
  const records = useAppStore((s) => s.records)
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const reseed = useAppStore((s) => s.reseed)
  const clearRecords = useAppStore((s) => s.clearRecords)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImportFile = (file: File) => {
    const fr = new FileReader()
    fr.onload = () => importData(String(fr.result))
    fr.readAsText(file)
  }

  return (
    <div>
      <div className="card">
        <div className="card-t">外观</div>
        <div className="field">
          <div className="k">主题</div>
          <div className="v">
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'auto')}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-t">抽签偏好</div>        <div className="field">
          <div className="k">
            显示夜宵
            <small>关闭后餐次与日历不再出现夜宵</small>
          </div>
          <button
            className={'sw' + (settings.midnight ? ' on' : '')}
            onClick={() => toggleSetting('midnight')}
            aria-label="切换夜宵"
          />
        </div>
        <div className="field">
          <div className="k">
            智能去重
            <small>7 天内吃过的菜降权（×0.3）</small>
          </div>
          <button
            className={'sw' + (settings.dedupe ? ' on' : '')}
            onClick={() => toggleSetting('dedupe')}
            aria-label="切换智能去重"
          />
        </div>
        <div className="field">
          <div className="k">默认份量</div>
          <div className="v">
            <select
              value={settings.serving}
              onChange={(e) => updateSetting('serving', Number(e.target.value))}
            >
              {[0.5, 1, 1.5, 2].map((s) => (
                <option key={s} value={s}>
                  {s} 份
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <div className="k">
            忌口过滤
            <small>命中的菜不会出现在候选里</small>
          </div>
          <div className="v">{settings.avoid.length} 项</div>
        </div>
        <div className="chips wrap">
          {AVOID_META.map((a) => (
            <button
              key={a.id}
              className={'chip' + (settings.avoid.includes(a.id) ? ' on' : '')}
              onClick={() => toggleAvoid(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-t">热量目标</div>
        <div className="field">
          <div className="k">
            启用每日目标
            <small>在日历与统计中显示进度</small>
          </div>
          <button
            className={'sw' + (settings.goalOn ? ' on' : '')}
            onClick={() => toggleSetting('goalOn')}
            aria-label="切换热量目标"
          />
        </div>
        {settings.goalOn ? (
          <div className="field">
            <div className="k">目标 kcal</div>
            <div className="v">
              <input
                type="number"
                value={settings.goal}
                style={{ width: 96 }}
                onChange={(e) => updateSetting('goal', Number(e.target.value) || 1800)}
              />
            </div>
          </div>
        ) : null}
        <p className="note">
          热量为基于常见食物成分表的估算值，受食材分量与烹饪方式影响较大，仅供参考，不构成营养或医学建议。
        </p>
      </div>

      <MyDishesCard />

      <div className="card">
        <div className="card-t">数据</div>
        <div className="field">
          <div className="k">记录条数</div>
          <div className="v">{records.length} 条</div>
        </div>
        <div className="row-acts wide">
          <button className="btn" onClick={exportData}>
            导出备份
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            导入备份
          </button>
          <button className="btn" onClick={reseed}>
            重置示例数据
          </button>
          <button
            className="btn"
            onClick={() => {
              if (window.confirm('确定清空全部用餐记录？此操作不可恢复，建议先导出备份。')) {
                clearRecords()
              }
            }}
          >
            清空记录
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="note">
          数据只保存在本设备浏览器中，清理浏览器数据会丢失，建议定期导出备份。示例数据用固定种子生成，重置后每次一致。
        </p>
      </div>

      <div className="card">
        <div className="card-t">关于</div>
        <div className="about">
          <img src={logoUrl} alt="今天吃什么 logo" />
          <div>
            <div className="t1">今天吃什么</div>
            <div className="t2">让每一餐都更简单</div>
          </div>
          <span className="ver">v{__APP_VERSION__}</span>
        </div>
        <div className="changelog">
          {CHANGELOG.map((e) => (
            <div key={e.version} className="cl-item">
              <div className="cl-head">
                <b>v{e.version}</b>
                <span>{e.date}</span>
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
  )
}
