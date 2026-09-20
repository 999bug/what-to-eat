/**
 * 测试环境初始化。
 * - jsdom 未实现 canvas，这里把 getContext 打成返回 null（Wheel 内部已判空），避免刷屏告警
 * - 每个用例后清理 DOM
 */
import { afterEach } from 'vitest'

HTMLCanvasElement.prototype.getContext = () => null

afterEach(() => {
  document.body.innerHTML = ''
})
