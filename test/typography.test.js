import { describe, it, expect } from 'vitest'
import {
  normalizeCopy,
  parsePoints,
  copyIsActive,
  toneColors,
  wrapText,
  DEFAULT_COPY,
  LAYOUTS,
  TONES,
} from '../src/core/typography.js'

/** 简易 measureText 替身：中文按 1em，英文按 0.55em。 */
function fakeCtx(px = 20) {
  return {
    measureText(text) {
      const w = [...String(text)].reduce((sum, ch) => sum + (/[\u4e00-\u9fa5]/.test(ch) ? 1 : 0.55), 0)
      return { width: w * px }
    },
  }
}

describe('文案设置', () => {
  it('默认不激活（不能默认改用户的图）', () => {
    const d = normalizeCopy({})
    expect(copyIsActive(d)).toBe(false)
    expect(d.title).toBe('')
    expect(d.price).toBe('')
    expect(DEFAULT_COPY.title).toBe('')
  })

  it('写了标题就激活', () => {
    expect(copyIsActive({ title: '新品上市' })).toBe(true)
    expect(copyIsActive({ price: '¥99' })).toBe(true)
    expect(copyIsActive({ badge: '限时' })).toBe(true)
    expect(copyIsActive({ subtitle: '副标题' })).toBe(true)
  })

  it('非法值被纠正', () => {
    const c = normalizeCopy({
      layout: 'nope',
      tone: 'nope',
      align: 'justify',
      scale: 99,
      scrim: -3,
      customBg: 'red',
      title: 'x'.repeat(200),
    })
    expect(c.layout).toBe(LAYOUTS[0].id)
    expect(c.tone).toBe(TONES[0].id)
    expect(c.align).toBe('left')
    expect(c.scale).toBe(1.6)
    expect(c.scrim).toBe(0)
    expect(c.customBg).toBe(DEFAULT_COPY.customBg)
    expect(c.title).toHaveLength(60)
  })

  it('所有排版都有中文说明', () => {
    for (const l of LAYOUTS) {
      expect(l.label.length).toBeGreaterThan(0)
      expect(l.hint.length).toBeGreaterThan(4)
    }
  })

  it('配色预设给出对比色', () => {
    const ink = toneColors(normalizeCopy({ tone: 'ink' }))
    expect(ink.bg).toBe('#1b1812')
    expect(ink.fg).toBe('#fffdf8')
    const custom = toneColors(normalizeCopy({ tone: 'custom', customBg: '#123456', customFg: '#abcdef', customAccent: '#ff0000' }))
    expect(custom.bg).toBe('#123456')
    expect(custom.fg).toBe('#abcdef')
    expect(custom.accent).toBe('#ff0000')
  })
})

describe('卖点解析', () => {
  it('支持中英文逗号、顿号、换行、分号', () => {
    // 最多 4 条，第 5 条起被丢弃（界面也只展示 4 条）
    expect(parsePoints('现货,顺丰\n包邮、当天发；限时')).toEqual(['现货', '顺丰', '包邮', '当天发'])
  })
  it('最多 4 条，空值过滤', () => {
    expect(parsePoints('a,b,c,d,e,f')).toEqual(['a', 'b', 'c', 'd'])
    expect(parsePoints('  ,  ,, ')).toEqual([])
    expect(parsePoints(null)).toEqual([])
  })
})

describe('折行', () => {
  it('中文按字折行，不超宽', () => {
    const ctx = fakeCtx(20)
    const lines = wrapText(ctx, '把一批图变成能直接发的一组图', 100, 5)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(100)
    expect(lines.join('')).toBe('把一批图变成能直接发的一组图')
  })

  it('英文按词折行', () => {
    const ctx = fakeCtx(20)
    const lines = wrapText(ctx, 'Golden Hour Limited Edition', 120, 5)
    expect(lines.join(' ')).toBe('Golden Hour Limited Edition')
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(120)
  })

  it('超过最大行数会截断并加省略号', () => {
    const ctx = fakeCtx(20)
    const lines = wrapText(ctx, '一'.repeat(40), 60, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })

  it('空文本返回空数组', () => {
    expect(wrapText(fakeCtx(), '   ', 100, 2)).toEqual([])
  })
})
