import { describe, it, expect } from 'vitest'
import {
  PLATFORM_PRESETS,
  PLATFORM_GROUPS,
  normalizeTargets,
  unionSafeArea,
  safeRect,
  buildOutputName,
  safeSlug,
  targetSummary,
  findPreset,
  platformGlyph,
} from '../src/core/platforms.js'


describe('平台预设', () => {
  it('每个预设字段完整且 id 唯一', () => {
    const ids = new Set()
    for (const p of PLATFORM_PRESETS) {
      expect(p.id).toBeTruthy()
      expect(p.platform).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.w).toBeGreaterThan(0)
      expect(p.h).toBeGreaterThan(0)
      expect(p.note.length).toBeGreaterThanOrEqual(4)
      expect(p.safe).toBeTruthy()
      for (const k of ['top', 'bottom', 'left', 'right']) {
        expect(p.safe[k]).toBeGreaterThanOrEqual(0)
        expect(p.safe[k]).toBeLessThan(0.5)
      }
      expect(ids.has(p.id)).toBe(false)
      ids.add(p.id)
    }
    expect(ids.size).toBeGreaterThanOrEqual(20)
  })

  it('覆盖国内外主要平台', () => {
    for (const name of ['小红书', '抖音', '视频号', '淘宝 / 天猫', 'B站', '公众号', 'Instagram', 'YouTube', 'TikTok', 'Pinterest']) {
      expect(PLATFORM_GROUPS).toContain(name)
    }
  })

  it('包含打印与网页交付规格', () => {
    expect(findPreset('print-a4')).toBeTruthy()
    expect(findPreset('web-hero')).toBeTruthy()
  })

  it('尺寸都是常见交付分辨率', () => {
    const xhs = findPreset('xiaohongshu')
    expect([xhs.w, xhs.h]).toEqual([1080, 1440])
    const douyin = findPreset('douyin')
    expect([douyin.w, douyin.h]).toEqual([1080, 1920])
    const yt = findPreset('youtube-thumb')
    expect([yt.w, yt.h]).toEqual([1280, 720])
  })
})

describe('目标选择', () => {
  it('归一化：去重 + 过滤未知 id', () => {
    expect(normalizeTargets(['xiaohongshu', 'nope', 'xiaohongshu', 'douyin']).map((p) => p.id))
      .toEqual(['xiaohongshu', 'douyin'])
  })

  it('非数组输入返回空', () => {
    expect(normalizeTargets(null)).toEqual([])
    expect(normalizeTargets('xiaohongshu')).toEqual([])
  })

  it('安全区取并集（最严格边）', () => {
    const area = unionSafeArea([findPreset('douyin'), findPreset('xiaohongshu')])
    expect(area.bottom).toBeCloseTo(0.2, 5) // 抖音底部 0.2 更严格
    expect(area.right).toBeCloseTo(0.16, 5)
    expect(area.top).toBeCloseTo(0.08, 5)
  })

  it('安全区矩形在画布内', () => {
    for (const p of PLATFORM_PRESETS) {
      const r = safeRect(p)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(p.w)
      expect(r.y + r.h).toBeLessThanOrEqual(p.h)
      expect(r.w).toBeGreaterThan(p.w * 0.5)
    }
  })

  it('摘要文案可读', () => {
    expect(targetSummary([])).toBe('未选择目标')
    expect(targetSummary([findPreset('douyin')])).toContain('抖音')
    const two = targetSummary([findPreset('douyin'), findPreset('xiaohongshu')])
    expect(two).toContain('2 个目标')
    expect(two).toContain('2 个平台')
  })
})

describe('输出文件名模板', () => {
  it('替换全部占位符', () => {
    const name = buildOutputName('{name}-{platform}-{w}x{h}-{index}', {
      name: 'IMG_001', platform: '小红书', w: 1080, h: 1440, index: 3, ext: 'jpg',
    })
    expect(name).toBe('IMG_001-小红书-1080x1440-03.jpg')
  })

  it('非法字符被清理，长度受限', () => {
    const name = buildOutputName('{name}', { name: 'a/b\\c:d*e?f"g<h>i|j', ext: 'webp' })
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
    expect(name.endsWith('.webp')).toBe(true)
  })

  it('空名字有兜底', () => {
    expect(buildOutputName('{name}', { name: '', ext: 'jpg' })).toBe('untitled.jpg')
    expect(safeSlug('', 10)).toBe('untitled')
  })

  it('重复调用结果稳定', () => {
    const ctx = { name: 'x', platform: '抖音', w: 1080, h: 1920, index: 1, ext: 'jpg' }
    expect(buildOutputName('{name}-{platform}', ctx)).toBe(buildOutputName('{name}-{platform}', ctx))
  })
})

describe('平台图标', () => {
  it('每个平台都有内联 SVG（不依赖外部图标库）', () => {
    for (const p of PLATFORM_PRESETS) {
      const g = platformGlyph(p.id)
      expect(g).toContain('<')
      expect(g).not.toContain('http')
    }
  })
  it('未知 id 有兜底图形', () => {
    expect(platformGlyph('nope')).toContain('<')
  })
})
