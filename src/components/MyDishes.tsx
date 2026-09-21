/**
 * 设置页「我的菜品」区：列表 / 编辑 / 删除用户自定义菜品。
 *
 * 为什么单独成组件：它是设置页里唯一带局部表单状态的区块，
 * 拆出来能避免把整页 SettingsPage 变成有状态组件。
 */
import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { CustomDishForm } from '@/components/CustomDishForm'
import { cuisineName, levelName, mealName } from '@/data/meta'
import { haptics } from '@/lib/haptics'
import type { CustomDish } from '@/types'

export function MyDishesCard() {
  const customDishes = useAppStore((s) => s.customDishes)
  const deleteCustomDish = useAppStore((s) => s.deleteCustomDish)
  const openCustomForm = useAppStore((s) => s.openCustomForm)
  const closeCustomForm = useAppStore((s) => s.closeCustomForm)
  const customFormOpen = useAppStore((s) => s.customFormOpen)
  const editingCustomId = useAppStore((s) => s.editingCustomId)
  const showToast = useAppStore((s) => s.showToast)
  /** 待确认删除的菜品 id（用二次确认代替 window.confirm，移动端更顺手） */
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const editing = editingCustomId
    ? (customDishes.find((c) => c.id === editingCustomId) ?? null)
    : null

  const remove = (c: CustomDish) => {
    deleteCustomDish(c.id)
    setConfirmId(null)
    showToast(`已删除「${c.name}」`)
  }

  return (
    <div className="card">
      <div className="card-t">
        我的菜品
        <span className="cform-count">{customDishes.length} 道</span>
        {customFormOpen ? null : (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              haptics.tap()
              openCustomForm()
            }}
          >
            ＋ 添加
          </button>
        )}
      </div>

      {customFormOpen ? (
        <CustomDishForm
          editing={editing}
          onSaved={() => closeCustomForm()}
          onCancel={closeCustomForm}
        />
      ) : null}

      {customDishes.length === 0 && !customFormOpen ? (
        <p className="note">
          还没有自己的菜。添加后会归入独立分类「我的菜品」，抽签页点「我的菜品」就只抽自己加的菜；
          同样受忌口与筛选约束，也参与补录与统计。
        </p>
      ) : null}

      {customDishes.map((c) => (
        <div key={c.id} className="item mydish">
          <span className="ico">{c.icon}</span>
          <div className="myinfo">
            <div className="nm">{c.name}</div>
            <div className="sub">
              {cuisineName(c.cuisines[0])} · {c.meals.map(mealName).join('/')} ·{' '}
              {levelName(c.level)} · {c.kcal === null ? '热量未知' : `${c.kcal} kcal`}
            </div>
          </div>
          {confirmId === c.id ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={() => remove(c)}>
                确认删除
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmId(null)}>
                取消
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-sm"
                onClick={() => {
                  haptics.tap()
                  openCustomForm(c.id)
                }}
              >
                编辑
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  haptics.tap()
                  setConfirmId(c.id)
                }}
                aria-label={`删除 ${c.name}`}
              >
                删除
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
