import { describe, it, expect } from 'vitest'
import {
  resolveCanvasSize,
  fitRect,
  watermarkPlacements,
  compressionPlan,
} from '../src/core/canvas-plan.js'
import { normalizeSettings } from '../src/core/settings.js'

const base = normalizeSettings({})

describe('resolveCanvasSize', () => {
  it('预设尺寸', () => {
    expect(resolveCanvasSize({ ...base, preset: 'portrait34' }, 4, 3)).toEqual({ w: 1080, h: 1440, presetId: 'portrait34' })
    expect(resolveCanvasSize({ ...base, preset: 'landscape169' }, 4, 3)).toEqual({ w: 1920, h: 1080, presetId: 'landscape169' })
  })
  it('原图尺寸', () => {
    expect(resolveCanvasSize({ ...base, preset: 'original' }, 801, 601)).toEqual({ w: 801, h: 601, presetId: 'original' })
  })
  it('自定义尺寸带边界', () => {
    expect(resolveCanvasSize({ ...base, preset: 'custom', customW: 99999, customH: 5 }, 10, 10))
      .toEqual({ w: 8000, h: 16, presetId: 'custom' })
  })
})

describe('fitRect', () => {
  it('contain 留白居中', () => {
    // 4:3 原图放进 1:1 画布 → 高度留白
    const r = fitRect(400, 300, 1000, 1000, 'contain')
    expect(r.drawW).toBe(1000)
    expect(r.drawH).toBe(750)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(125)
  })
  it('cover 铺满居中', () => {
    const r = fitRect(400, 300, 1000, 1000, 'cover')
    expect(r.drawW).toBe(1333)
    expect(r.drawH).toBe(1000)
    expect(r.dx).toBe(-166)
    expect(r.dy).toBe(0)
    // 居中：左右留出相等（允许 1px 取整差）
    expect(Math.abs(r.dx - (1000 - r.drawW) / 2)).toBeLessThanOrEqual(0.5)
  })
})

describe('watermarkPlacements', () => {
  const wm = { pos: 'br', size: 4, tiled: false }
  const W = 1000
  const H = 1400

  it('右下角', () => {
    const [p] = watermarkPlacements({ text: 'x', textWidth: 100, wm, W, H })
    expect(p.align).toBe('right')
    expect(p.baseline).toBe('bottom')
    expect(p.x).toBeLessThan(W)
    expect(p.y).toBeLessThan(H)
  })

  it('居中', () => {
    const [p] = watermarkPlacements({ text: 'x', textWidth: 100, wm: { ...wm, pos: 'center' }, W, H })
    expect(p.x).toBe(500)
    expect(p.y).toBe(700)
    expect(p.align).toBe('center')
  })

  it('平铺覆盖整张画布', () => {
    const list = watermarkPlacements({ text: 'x', textWidth: 100, wm: { ...wm, tiled: true }, W, H })
    expect(list.length).toBeGreaterThan(10)
    expect(list.every((p) => p.rotate !== 0)).toBe(true)
    const xs = list.map((p) => p.x)
    const ys = list.map((p) => p.y)
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(W)
    expect(Math.min(...ys)).toBeLessThan(0)
    expect(Math.max(...ys)).toBeGreaterThan(H)
  })
})

describe('compressionPlan', () => {
  it('无目标时只返回质量步骤', () => {
    const plan = compressionPlan({ quality: 0.85, targetBytes: 0 })
    expect(plan.every((s) => s.scale === 1)).toBe(true)
    expect(plan[0].quality).toBe(0.85)
    expect(plan.length).toBeGreaterThan(1)
  })

  it('有目标时先质量后缩放', () => {
    const plan = compressionPlan({ quality: 0.85, targetBytes: 500 * 1024 })
    const scales = plan.map((s) => s.scale)
    expect(scales).toContain(1)
    expect(scales[scales.length - 1]).toBeLessThan(1)
    // 质量递减
    const qualities = plan.filter((s) => s.scale === 1).map((s) => s.quality)
    const sorted = [...qualities].sort((a, b) => b - a)
    expect(qualities).toEqual(sorted)
    // 质量都在合法区间
    for (const s of plan) {
      expect(s.quality).toBeGreaterThanOrEqual(0.35 - 1e-6)
      expect(s.scale).toBeGreaterThanOrEqual(0.5 - 1e-6)
    }
  })
})
