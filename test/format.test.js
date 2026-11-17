import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  formatKB,
  formatDelta,
  baseName,
  extForMime,
  isAcceptedImage,
  csvCell,
  toCSV,
  dedupeName,
  clamp,
  uid,
} from '../src/core/format.js'

describe('format', () => {
  it('formatBytes 人类可读', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3.2 * 1024 ** 3)).toBe('3.2 GB')
    expect(formatBytes(NaN)).toBe('—')
  })

  it('formatKB', () => {
    expect(formatKB(512 * 1024)).toBe('512 KB')
    expect(formatKB(256 * 1024)).toBe('256 KB')
    expect(formatKB(0)).toBe('—')
  })

  it('formatDelta 正负与持平', () => {
    expect(formatDelta(1000, 400)).toBe('省 60%')
    expect(formatDelta(1000, 1200)).toBe('增 20%')
    expect(formatDelta(1000, 1000)).toBe('持平')
  })

  it('baseName / extForMime', () => {
    expect(baseName('a.b.jpg')).toBe('a.b')
    expect(baseName('noext')).toBe('noext')
    expect(extForMime('image/jpeg')).toBe('jpg')
    expect(extForMime('image/webp')).toBe('webp')
    expect(extForMime('image/png')).toBe('png')
  })

  it('isAcceptedImage 按类型与后缀', () => {
    expect(isAcceptedImage({ type: 'image/png', name: 'x' })).toBe(true)
    expect(isAcceptedImage({ type: '', name: 'x.WEBP' })).toBe(true)
    expect(isAcceptedImage({ type: 'image/gif', name: 'x.gif' })).toBe(false)
    expect(isAcceptedImage(null)).toBe(false)
  })

  it('csvCell 转义引号逗号换行', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(null)).toBe('')
  })

  it('toCSV 带 BOM 与 CRLF', () => {
    const out = toCSV([['a', 'b'], ['1', '2']])
    expect(out.charCodeAt(0)).toBe(0xfeff)
    expect(out).toContain('a,b\r\n1,2')
  })

  it('dedupeName 递增不重复', () => {
    const used = new Set()
    expect(dedupeName('a.jpg', used)).toBe('a.jpg')
    expect(dedupeName('a.jpg', used)).toBe('a_2.jpg')
    expect(dedupeName('a.jpg', used)).toBe('a_3.jpg')
    expect(dedupeName('b.png', used)).toBe('b.png')
  })

  it('clamp / uid', () => {
    expect(clamp(5, 1, 3)).toBe(3)
    expect(clamp(0, 1, 3)).toBe(1)
    expect(uid('x')).toMatch(/^x-/)
    expect(uid('x')).not.toBe(uid('x'))
  })
})
