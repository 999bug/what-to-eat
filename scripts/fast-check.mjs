// 提交前快速验证：并行跑 tsc + eslint + vitest（小仓库全量也快，几十秒内）
// 用法：npm run check；任一失败即退出码 1
import { spawn } from 'node:child_process'

function run(label, args) {
  return new Promise((resolve) => {
    const p = spawn('npx', args, { shell: true, stdio: 'inherit' })
    p.on('exit', (code) => resolve({ label, ok: code === 0 }))
    p.on('error', () => resolve({ label, ok: false }))
  })
}

const results = await Promise.all([
  run('tsc', ['tsc', '-b']),
  run('eslint', ['eslint', '.']),
  run('vitest', ['vitest', 'run']),
])

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\ncheck 失败：${failed.map((f) => f.label).join(' / ')}`)
  process.exit(1)
}
console.log('\ncheck 全绿：tsc + eslint + vitest')
