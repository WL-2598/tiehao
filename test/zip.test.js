import { describe, it, expect } from 'vitest'
import { buildManifest } from '../src/core/zip.js'
import { normalizeSettings } from '../src/core/settings.js'

describe('buildManifest', () => {
  const settings = normalizeSettings({ preset: 'portrait34', fit: 'contain', format: 'image/webp', targetKB: 500 })
  const items = [{
    outName: 'a.webp',
    result: { name: 'a.webp', width: 1080, height: 1440, afterBytes: 256 * 1024 },
    srcName: 'DSC0001.jpg',
    beforeBytes: 1024 * 1024,
  }]

  it('包含表头与一行数据，带 BOM', () => {
    const csv = buildManifest(items, settings)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].split(',')).toEqual([
      '输出文件', '原文件', '平台', '规格', '画布尺寸', '适配方式', '格式',
      '宽度px', '高度px', '原始大小KB', '输出大小KB', '体积变化', '是否达标',
    ])
    expect(lines[1]).toContain('a.webp')
    expect(lines[1]).toContain('DSC0001.jpg')
    expect(lines[1]).toContain('1080×1440')
    expect(lines[1]).toContain('WebP')
    expect(lines[1]).toContain('-75.0%')
  })

  it('带上平台与达标状态', () => {
    const csv = buildManifest(
      [{ ...items[0], platform: '小红书', targetName: '图文 3:4', result: { ...items[0].result, hitTarget: false } }],
      settings,
    )
    expect(csv).toContain('小红书')
    expect(csv).toContain('图文 3:4')
    expect(csv).toContain('未达目标')
  })

  it('含逗号/引号的名字会被转义', () => {
    const csv = buildManifest([{ ...items[0], srcName: 'a,b"c.jpg' }], settings)
    expect(csv).toContain('"a,b""c.jpg"')
  })
})
