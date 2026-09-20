/**
 * 更新日志与版本号同步。
 * 约定：发版时先改 package.json 的 version，再在 CHANGELOG 头部追加同版本条目；
 * 这条用例防止「版本升了但更新日志没写」或「日期格式写错」。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHANGELOG } from '@/changelog/changelogData'

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { version: string }

describe('CHANGELOG', () => {
  it('至少有一条记录', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
  })

  it('头部条目版本与 package.json 一致', () => {
    expect(CHANGELOG[0].version).toBe(pkg.version)
  })

  it('日期格式为 YYYY-MM-DD', () => {
    for (const e of CHANGELOG) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('每条都有实际内容且版本不重复', () => {
    const versions = new Set<string>()
    for (const e of CHANGELOG) {
      expect(e.features.length).toBeGreaterThan(0)
      for (const f of e.features) expect(f.trim()).not.toBe('')
      expect(versions.has(e.version)).toBe(false)
      versions.add(e.version)
    }
  })

  it('按版本倒序排列', () => {
    const cmp = (a: string, b: string) => {
      const pa = a.split('.').map(Number)
      const pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
      return 0
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(cmp(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeLessThan(0)
    }
  })
})
