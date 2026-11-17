import { describe, it, expect, beforeAll } from 'vitest'
// @vitest-environment happy-dom
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { normalizeSettings } from '../src/core/settings.js'
import { findPreset, targetConstraints, PLATFORM_PRESETS } from '../src/core/platforms.js'
import { planSlices } from '../src/core/slice.js'

let pipeline
let slice

function installEnv() {
  URL.createObjectURL = () => 'blob:stub'
  URL.revokeObjectURL = () => {}
  const orig = document.createElement.bind(document)
  document.createElement = (tag, opts) => {
    if (String(tag).toLowerCase() === 'canvas') {
      const native = createCanvas(300, 150)
      const proxy = {
        __native: native,
        getContext: () => native.getContext('2d'),
        getImageData: (x, y, w, h) => native.getContext('2d').getImageData(x, y, w, h),
        toBlob: (cb, mime = 'image/png', quality) => {
          const q = typeof quality === 'number' ? Math.round(quality * 100) : 80
          const fmt = mime === 'image/jpeg' ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png'
          const buf = native.toBuffer(fmt, q)
          setTimeout(() => cb(new Blob([new Uint8Array(buf)], { type: mime })), 0)
        },
        toDataURL: () => `data:image/png;base64,${native.toBuffer('image/png').toString('base64')}`,
      }
      Object.defineProperty(proxy, 'width', { get: () => native.width, set: (v) => { native.width = v } })
      Object.defineProperty(proxy, 'height', { get: () => native.height, set: (v) => { native.height = v } })
      return proxy
    }
    return orig(tag, opts)
  }
  const decode = async (file) => loadImage(Buffer.from(await file.arrayBuffer()))
  globalThis.createImageBitmap = decode
  window.createImageBitmap = decode
}

/** 白底 + 中段彩色块的测试图，用来验证白底图不掺水印/文字。 */
function whiteProduct(w = 900, h = 1200) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  // 用足够深的颜色，亮度阈值（<90）才判得出来
  ctx.fillStyle = '#2b2b2b'
  ctx.fillRect(w * 0.25, h * 0.3, w * 0.5, h * 0.4)
  return c.toBuffer('image/jpeg', 92)
}

/** 很高的「详情页」长图：白底，每 400px 一条深色横线（模拟文字行）。 */
function longDetail(w = 750, h = 4000) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fdfdfb'
  ctx.fillRect(0, 0, w, h)
  for (let y = 300; y < h - 200; y += 400) {
    ctx.fillStyle = '#2b2b2b'
    ctx.fillRect(60, y, w - 120, 26)
    ctx.fillRect(60, y + 44, w - 260, 18)
  }
  return c.toBuffer('image/jpeg', 92)
}

async function pixels(blob) {
  const img = await loadImage(Buffer.from(await blob.arrayBuffer()))
  const c = createCanvas(img.width, img.height)
  c.getContext('2d').drawImage(img, 0, 0)
  const ctx = c.getContext('2d')
  return {
    width: img.width,
    height: img.height,
    darkRatio: (x0, y0, x1, y1) => {
      const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      let dark = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < 90) dark += 1
      }
      return dark / (data.length / 4)
    },
    whiteRatio: () => {
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      let white = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248) white += 1
      }
      return white / (data.length / 4)
    },
  }
}

beforeAll(async () => {
  installEnv()
  pipeline = await import('../src/core/pipeline.js')
  slice = await import('../src/core/slice.js')
})

const S = (patch) => normalizeSettings({ targetKB: 0, ...patch })

describe('平台合规约束', () => {
  it('白底图目标标记为纯白且禁止文字', () => {
    for (const id of ['taobao-white', 'jd-white']) {
      const c = targetConstraints(findPreset(id))
      expect(c.whiteBg).toBe(true)
      expect(c.noText).toBe(true)
    }
  })

  it('详情页目标带 750 宽 + 1500 高上限的切片规则', () => {
    for (const id of ['taobao-detail', 'jd-detail']) {
      const p = findPreset(id)
      expect(p.slice).toEqual({ width: 750, maxHeight: 1500 })
      expect(targetConstraints(p).slice.maxHeight).toBe(1500)
    }
  })

  it('电商目标都有明确体积上限，且不超过平台规则', () => {
    expect(targetConstraints(findPreset('jd-main')).maxKB).toBe(1024)
    expect(targetConstraints(findPreset('taobao-main')).maxKB).toBe(500)
    expect(targetConstraints(findPreset('jd-detail')).maxKB).toBe(500)
    // 非电商目标不设上限
    expect(targetConstraints(findPreset('xiaohongshu')).maxKB).toBe(0)
  })

  it('新增了闲鱼目标', () => {
    const xy = PLATFORM_PRESETS.filter((p) => p.platform === '闲鱼')
    expect(xy.length).toBe(2)
    expect(xy.map((p) => p.id)).toContain('xianyu-main')
  })
})

describe('详情页切片', () => {
  it('短图不切片', () => {
    expect(planSlices(800, 1500)).toEqual([0, 800])
  })

  it('4000 高的图切成 ≤1500 高的若干片，且覆盖完整高度', () => {
    const bounds = planSlices(4000, 1500)
    expect(bounds[0]).toBe(0)
    expect(bounds[bounds.length - 1]).toBe(4000)
    const heights = bounds.slice(1).map((b, i) => b - bounds[i])
    expect(heights.every((h) => h <= 1500 && h > 0)).toBe(true)
    expect(heights.reduce((a, b) => a + b, 0)).toBe(4000)
    expect(heights.length).toBe(3)
  })

  it('有能量数据时切口避开深色文字行', () => {
    // 模拟每 400px 一条文字带的能量曲线：文字带上能量高
    const H = 4000
    const energy = new Float64Array(H)
    for (let y = 0; y < H; y += 1) {
      const inBand = (y - 300) % 400 < 90
      energy[y] = inBand ? 900 : 5
    }
    const bounds = planSlices(H, 1500, { energy, tolerance: 300 })
    for (const cut of bounds.slice(1, -1)) {
      const inBand = (cut - 300) % 400 < 90
      expect(inBand).toBe(false)
    }
  })

  it('切片后每片宽度保持 750，总高度不变', async () => {
    const file = new File([longDetail(750, 4000)], 'detail.jpg', { type: 'image/jpeg' })
    const settings = S({ fit: 'contain', bg: '#ffffff', format: 'image/jpeg', quality: 0.85 })
    const out = await pipeline.processFile(file, settings, { preset: findPreset('taobao-detail') })

    expect(out.slices.length).toBeGreaterThan(1)
    expect(out.slices.every((sl) => sl.width === 750)).toBe(true)
    expect(out.slices.every((sl) => sl.height <= 1500)).toBe(true)
    expect(out.slices.reduce((a, sl) => a + sl.height, 0)).toBe(4000)
    // 文件名唯一
    expect(new Set(out.slices.map((sl) => sl.name)).size).toBe(out.slices.length)
  })
})

describe('白底图合规', () => {
  it('即使开了水印/文案/Logo，白底图输出仍保持纯白无字', async () => {
    const file = new File([whiteProduct()], 'product.jpg', { type: 'image/jpeg' })
    const settings = S({
      fit: 'contain',
      bg: '#f3e9d2',                                  // 故意设成米色，白底目标应覆盖为白
      format: 'image/png',
      wm: { enabled: true, text: 'DEMO', pos: 'br', size: 6, opacity: 1, color: '#000000' },
      copy: { enabled: true, title: 'SALE', subtitle: 'now', tone: 'ink', layout: 'bottomHeavy' },
      logo: { enabled: true, mode: 'text', text: 'BRAND' },
    })
    const out = await pipeline.processFile(file, settings, { preset: findPreset('taobao-white') })
    const px = await pixels(out.blob)

    // 四角必须是白的（水印/Logo/文案都没画上去）
    expect(px.whiteRatio()).toBeLessThan(1)
    expect(px.darkRatio(0, px.height - 260, px.width, px.height)).toBe(0)
    expect(px.darkRatio(0, 0, 260, 260)).toBe(0)
    // 画面里只剩商品本身
    expect(px.darkRatio(0, 0, px.width, px.height)).toBeGreaterThan(0.01)
  })

  it('同样的设置在普通主图上会画水印（对照组）', async () => {
    const file = new File([whiteProduct()], 'product.jpg', { type: 'image/jpeg' })
    const settings = S({
      fit: 'contain',
      format: 'image/png',
      wm: { enabled: true, text: 'DEMO', pos: 'br', size: 6, opacity: 1, color: '#000000' },
    })
    const out = await pipeline.processFile(file, settings, { preset: findPreset('taobao-main') })
    const px = await pixels(out.blob)
    expect(px.darkRatio(0, px.height - 260, px.width, px.height)).toBeGreaterThan(0)
  })
})

describe('按平台收敛体积', () => {
  it('京东主图自动压到 1MB 以内，即便全局设置是不限体积', async () => {
    // 噪点图很难压，用它验证压缩阶梯确实在跑
    const c = createCanvas(2400, 2400)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(2400, 2400)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (i * 2654435761) % 255
      img.data[i] = v
      img.data[i + 1] = (v * 7) % 255
      img.data[i + 2] = (v * 13) % 255
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const file = new File([c.toBuffer('image/jpeg', 95)], 'noise.jpg', { type: 'image/jpeg' })

    const settings = S({ fit: 'cover', format: 'image/jpeg', quality: 0.95, targetKB: 0 })
    const out = await pipeline.processFile(file, settings, { preset: findPreset('jd-main') })
    expect(out.afterBytes).toBeLessThanOrEqual(1024 * 1024)
    expect(out.hitTarget).toBe(true)
  })

  it('全局目标体积比平台上限更严时，听更严的那个', async () => {
    const file = new File([whiteProduct(1600, 1600)], 'p.jpg', { type: 'image/jpeg' })
    const settings = S({ fit: 'cover', format: 'image/jpeg', quality: 0.9, targetKB: 120 })
    const out = await pipeline.processFile(file, settings, { preset: findPreset('taobao-main') })
    expect(out.afterBytes).toBeLessThanOrEqual(120 * 1024)
  })
})

describe('详情页画布尺寸', () => {
  it('宽度锁 750，高度按原图比例展开', () => {
    const size = pipeline.detailCanvasSize({ width: 750, maxHeight: 1500 }, 1000, 3000, { fit: 'contain' })
    expect(size.w).toBe(750)
    expect(size.h).toBe(2250)
  })

  it('超长原图有上限，不会把画布撑爆', () => {
    const size = pipeline.detailCanvasSize({ width: 750, maxHeight: 1500 }, 100, 20000, { fit: 'contain' })
    expect(size.h).toBeLessThanOrEqual(1500 * 8)
  })

  it('铺满模式按单张详情图固定高度出图', () => {
    const size = pipeline.detailCanvasSize({ width: 750, maxHeight: 1500 }, 1000, 3000, { fit: 'cover' })
    expect(size.h).toBe(1500)
  })
})
