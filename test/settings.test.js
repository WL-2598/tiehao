import { describe, it, expect } from 'vitest'
import { normalizeSettings, DEFAULT_SETTINGS, CANVAS_PRESETS } from '../src/core/settings.js'

describe('normalizeSettings', () => {
  it('空输入得到默认值', () => {
    const s = normalizeSettings({})
    expect(s.preset).toBe(DEFAULT_SETTINGS.preset)
    expect(s.fit).toBe('contain')
    expect(s.format).toBe('image/jpeg')
    expect(s.quality).toBe(0.85)
    expect(s.wm.enabled).toBe(true)
  })

  it('非法值被纠正', () => {
    const s = normalizeSettings({
      preset: 'nope',
      fit: 'stretch',
      format: 'image/gif',
      quality: 99,
      targetKB: -5,
      customW: 'abc',
      bg: 'red',
      wm: { pos: 'everywhere', size: 999, opacity: 0, color: '#fff', enabled: 'yes' },
    })
    expect(s.preset).toBe(DEFAULT_SETTINGS.preset)
    expect(s.fit).toBe('contain')
    expect(s.format).toBe('image/jpeg')
    expect(s.quality).toBe(1)
    expect(s.targetKB).toBe(0)
    expect(s.customW).toBe(DEFAULT_SETTINGS.customW)
    expect(s.bg).toBe(DEFAULT_SETTINGS.bg)
    expect(s.wm.pos).toBe('br')
    expect(s.wm.size).toBe(20)
    expect(s.wm.opacity).toBe(0.05)
    expect(s.wm.color).toBe(DEFAULT_SETTINGS.wm.color)
    expect(s.wm.enabled).toBe(true)
  })

  it('合法值保留', () => {
    const s = normalizeSettings({
      preset: 'custom', customW: 800, customH: 600, fit: 'cover',
      format: 'image/webp', quality: 0.6, targetKB: 300,
      wm: { text: '小店', pos: 'tl', size: 6, opacity: 0.5, tiled: true },
    })
    expect(s.preset).toBe('custom')
    expect(s.customW).toBe(800)
    expect(s.fit).toBe('cover')
    expect(s.format).toBe('image/webp')
    expect(s.quality).toBe(0.6)
    expect(s.targetKB).toBe(300)
    expect(s.wm.text).toBe('小店')
    expect(s.wm.pos).toBe('tl')
    expect(s.wm.tiled).toBe(true)
  })

  it('预设 id 都在画布预设列表里', () => {
    const ids = CANVAS_PRESETS.map((p) => p.id)
    for (const id of ['portrait34', 'square11', 'landscape169', 'vertical916', 'original', 'custom']) {
      expect(ids).toContain(id)
    }
  })
})
