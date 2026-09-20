/**
 * 版本号比较与远端版本探测。
 *
 * 更新提示的判定来源：部署目录下的 `version.json`（构建时由 vite 插件生成，
 * 见 `vite.config.ts`）。本地版本取构建期注入的 `__APP_VERSION__`，两者不一致
 * 即说明线上已经有新版本，提示用户刷新即可（本项目无 Service Worker，
 * 不做静默接管，刷新是唯一的取新版手段）。
 */

/** 解析版本号：'v1.2.3' → [1, 2, 3]；非数字段记 0，不足三位补 0 */
export function parseVersion(v: string): [number, number, number] {
  const parts = String(v)
    .trim()
    .replace(/^v/i, '')
    .split(/[.\-+]/)
  const nums = parts.map((p) => {
    const n = Number.parseInt(p, 10)
    return Number.isFinite(n) ? n : 0
  })
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0]
}

/** remote 严格大于 local 时返回 true（相等或更旧均为 false） */
export function isNewer(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/**
 * 读取线上 version.json 的版本号。
 * 离线、文件缺失、格式异常一律返回 null，由调用方静默处理（不影响主流程）。
 */
export async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' && data.version !== '' ? data.version : null
  } catch {
    return null
  }
}
