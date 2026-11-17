/**
 * 免费 / 付费分层。
 * 原则：核心出图永远免费可用（不阉割体验），把「一次交付多套规格」的专业能力放进买断版。
 * 在线版：3 张 / 批、3 个常用平台、最多 5 个目标、无文案层 / Logo / 白边裁剪 / 焦点裁切。
 * 离线版：30 张 / 批、全部平台、文案层 + Logo + 白边裁剪 + 焦点裁切。
 */

import { toast } from './ui.js'

export const LOCKED_MESSAGE = '这是离线批量版的能力：一次交付多套规格 + 版面编辑'

export function createLocks({ edition, config, openBuy }) {
  const offline = edition === 'offline'
  const freeTargets = new Set(config.webFreeTargets || [])
  const lockedFeatures = new Set(offline ? [] : config.webLockedFeatures || [])

  const api = {
    offline,
    /** 该平台目标是否可用（在线版只放开常用平台）。 */
    targetAllowed(id) {
      return offline || freeTargets.has(id)
    },
    /** 专业能力是否锁定。 */
    featureLocked(name) {
      return lockedFeatures.has(name)
    },
    maxTargets() {
      return offline ? (config.maxTargetsOffline ?? 12) : (config.maxTargets ?? 5)
    },
    /**
     * 需要付费能力时：弹购买窗 + 提示，返回 false 让调用方直接 return。
     * 关键点：不静默失败，用户永远知道发生了什么、以及怎么解锁。
     */
    requireFeature(name, label) {
      if (!api.featureLocked(name)) return true
      toast(`${label}属于离线批量版能力`, 'alert', 3600)
      openBuy(label)
      return false
    },
    requireTarget(id, label) {
      if (api.targetAllowed(id)) return true
      toast(`「${label}」需要离线批量版；在线版可试 ${config.webFreeTargets.length} 个常用平台`, 'alert', 3800)
      openBuy('更多平台规格')
      return false
    },
  }
  return api
}
