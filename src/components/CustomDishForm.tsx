/**
 * 手动录入菜品表单（新建 / 编辑共用）。
 *
 * 设计目标：**快速简单**——菜名是唯一必填项，其余全部有合理默认值，
 * 用户只要打几个字就能存下来；想精细再展开「更多选项」。
 *
 * 分层约定：本组件只收集草稿状态，规范化与落盘一律走 lib/custom.ts + store actions。
 */
import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { CustomDishInput } from '@/stores/useAppStore'
import { CUISINES, LEVEL_META, MEALS, TAG_META } from '@/data/meta'
import { CUSTOM_DEFAULTS, NAME_MAX, parseKcal } from '@/lib/custom'
import { haptics } from '@/lib/haptics'
import type { CustomDish, DishLevel, MealId } from '@/types'

/** 常用图标，避免用户为了选个图标去翻 emoji 表 */
const ICON_PICKS = ['🍽️', '🍚', '🍜', '🍲', '🥘', '🍳', '🥗', '🍖', '🐟', '🥟', '🍰', '🧋'] as const

interface Props {
  /** 传入表示编辑既有菜品；不传为新建 */
  editing?: CustomDish | null
  /** 保存成功回调（拿到保存后的菜品，便于调用方决定是否补记一条记录） */
  onSaved?: (dish: CustomDish) => void
  /** 取消 */
  onCancel: () => void
}

export function CustomDishForm({ editing, onSaved, onCancel }: Props) {
  const addCustomDish = useAppStore((s) => s.addCustomDish)
  const updateCustomDish = useAppStore((s) => s.updateCustomDish)
  const meal = useAppStore((s) => s.meal)
  const showToast = useAppStore((s) => s.showToast)

  // 草稿态：编辑时用既有值回填
  const [name, setName] = useState(editing?.name ?? '')
  const [kcal, setKcal] = useState(editing?.kcal != null ? String(editing.kcal) : '')
  const [icon, setIcon] = useState(editing?.icon ?? CUSTOM_DEFAULTS.icon)
  const [ingredients, setIngredients] = useState(editing?.ingredients ?? '')
  const [cuisines, setCuisines] = useState<string[]>(
    editing?.cuisines ?? [CUSTOM_DEFAULTS.cuisine],
  )
  const [meals, setMeals] = useState<MealId[]>(editing?.meals ?? [meal])
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const [level, setLevel] = useState<DishLevel>(editing?.level ?? CUSTOM_DEFAULTS.level)
  /** 默认收起高级项，保持首屏只有「菜名 + 热量 + 保存」 */
  const [more, setMore] = useState(false)

  const canSave = name.trim() !== ''

  const toggle = <T,>(list: T[], v: T, setter: (next: T[]) => void) => {
    haptics.tap()
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }

  const save = () => {
    if (!canSave) return
    const input: CustomDishInput = {
      name,
      icon,
      kcal: parseKcal(kcal),
      cuisines,
      meals,
      ingredients,
      tags,
      level,
    }
    if (editing) {
      updateCustomDish(editing.id, input)
      showToast('已更新「' + name.trim() + '」')
      haptics.select()
      onSaved?.({ ...editing, ...input, kcal: parseKcal(kcal) } as CustomDish)
    } else {
      const created = addCustomDish(input)
      showToast(parseKcal(kcal) === null ? '已加入菜库（热量未知）' : '已加入菜库')
      haptics.select()
      onSaved?.(created)
    }
  }

  return (
    <div className="cform">
      {/* 菜名：唯一必填，放最前，自动聚焦 */}
      <div className="cform-row">
        <span className="ico-pick" aria-hidden="true">
          {icon}
        </span>
        <input
          className="search cform-name"
          placeholder="菜名，比如「可乐鸡翅」"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) save()
          }}
        />
      </div>

      {/* 热量：选填，留空按「未知」处理并说明后果 */}
      <div className="cform-row">
        <input
          className="cform-kcal"
          type="number"
          inputMode="numeric"
          placeholder="热量（选填）"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
        />
        <span className="cform-unit">kcal / 份</span>
      </div>
      {kcal.trim() !== '' && parseKcal(kcal) === null ? (
        <p className="cform-warn">热量需为正数，当前会按「未知」处理</p>
      ) : kcal.trim() === '' ? (
        <p className="cform-hint">不填也能保存，统计时会跳过这道菜的热量</p>
      ) : null}

      <div className="cform-acts">
        <button className="btn btn-sm btn-ghost" onClick={() => setMore((v) => !v)}>
          {more ? '收起更多选项' : '更多选项'}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          取消
        </button>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={!canSave}>
          {editing ? '保存修改' : '存进菜库'}
        </button>
      </div>

      {more ? (
        <div className="cform-more">
          <div className="cform-sec">
            <div className="lb">图标</div>
            <div className="chips wrap">
              {ICON_PICKS.map((i) => (
                <button
                  key={i}
                  className={'chip ico-chip' + (icon === i ? ' on' : '')}
                  onClick={() => {
                    haptics.tap()
                    setIcon(i)
                  }}
                  aria-label={'图标 ' + i}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="cform-sec">
            <div className="lb">菜系（可多选）</div>
            <div className="chips wrap">
              {CUISINES.map((c) => (
                <button
                  key={c.id}
                  className={'chip' + (cuisines.includes(c.id) ? ' on' : '')}
                  onClick={() => toggle(cuisines, c.id, setCuisines)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="cform-sec">
            <div className="lb">适合餐次（不选=全餐次）</div>
            <div className="chips wrap">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  className={'chip' + (meals.includes(m.id) ? ' on' : '')}
                  onClick={() => toggle(meals, m.id, setMeals)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="cform-sec">
            <div className="lb">难度</div>
            <div className="chips wrap">
              {LEVEL_META.map((l) => (
                <button
                  key={l.id}
                  className={'chip' + (level === l.id ? ' on' : '')}
                  onClick={() => {
                    haptics.tap()
                    setLevel(l.id)
                  }}
                  title={l.desc}
                >
                  {l.name}
                  <small>{l.desc}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="cform-sec">
            <div className="lb">口味标签（可多选）</div>
            <div className="chips wrap">
              {TAG_META.map((t) => (
                <button
                  key={t.id}
                  className={'chip' + (tags.includes(t.id) ? ' on' : '')}
                  onClick={() => toggle(tags, t.id, setTags)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="cform-sec">
            <div className="lb">主要食材（选填，用于补录搜索与忌口过滤）</div>
            <input
              className="search"
              placeholder="比如「鸡翅、可乐、姜」"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
