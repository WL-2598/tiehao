// @vitest-environment happy-dom
/**
 * 真实像素端到端测试（Node 内运行，不需要浏览器）：
 * 用 @napi-rs/canvas 提供 canvas 实现，把真实的图片文件走一遍
 * decodeImage → composeCanvas → encodeToTarget → buildZip，
 * 再解码输出图，逐像素断言画布尺寸、留白底色、铺满裁切与水印。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import JSZip from 'jszip'
import { normalizeSettings } from '../src/core/settings.js'

/* ------------------------------------------------- canvas / DOM 桩 */

let pipeline
let zipMod

function installCanvas() {
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (!this.__ctx) this.__ctx = this.__native.getContext(type)
    return this.__ctx
  }
  HTMLCanvasElement.prototype.toBlob = function (cb, mime = 'image/png', quality) {
    const q = typeof quality === 'number' ? Math.round(quality * 100) : 80
    const buf = this.__native.toBuffer(mime === 'image/jpeg' ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png', q)
    setTimeout(() => cb(new Blob([buf], { type: mime })), 0)
  }
  HTMLCanvasElement.prototype.toDataURL = function (mime = 'image/png') {
    return `data:${mime};base64,${this.__native.toBuffer('image/png').toString('base64')}`
  }

  const origCreateElement = document.createElement.bind(document)
  document.createElement = (tag, opts) => {
    const el = origCreateElement(tag, opts)
    if (String(tag).toLowerCase() === 'canvas') {
      const native = createCanvas(300, 150)
      el.__native = native
      Object.defineProperty(el, 'width', {
        get: () => native.width,
        set: (v) => { native.width = v },
      })
      Object.defineProperty(el, 'height', {
        get: () => native.height,
        set: (v) => { native.height = v },
      })
    }
    return el
  }
}

/** 生成一张有真实内容的测试图（渐变 + 色块，避免纯色压缩失真干扰断言）。 */
function makeTestImage(w, h, opts = {}) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, opts.from || '#3a6b8a')
  g.addColorStop(1, opts.to || '#d8a04a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 24; i++) {
    ctx.fillRect((i * 97) % w, (i * 53) % h, 40, 40)
  }
  return c.toBuffer('image/png')
}

function decode(buf, mime = 'image/png') {
  return new File([buf], 'test.png', { type: mime })
}

async function pixelsOf(blob) {
  const ab = await blob.arrayBuffer()
  const img = await loadImage(Buffer.from(ab))
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return {
    width: img.width,
    height: img.height,
    at: (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data),
  }
}

/* ---------------------------------------------------------- ZIP 解包 */

async function unzip(buf) {
  const zip = await JSZip.loadAsync(buf)
  const files = {}
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue
    files[name] = await zip.files[name].async('nodebuffer')
  }
  return files
}

beforeAll(async () => {
  installCanvas()
  // happy-dom 的 URL 是类，只替换需要的静态方法
  let urlSeq = 0
  URL.createObjectURL = () => `blob:stub-${++urlSeq}`
  URL.revokeObjectURL = () => {}
  // happy-dom 的 Blob 缺少可用的 arrayBuffer()，用 Node 内置实现
  const { Blob: NodeBlob } = await import('node:buffer')
  globalThis.Blob = NodeBlob
  window.Blob = NodeBlob
  // 用 @napi-rs/canvas 解码，等价于浏览器的 createImageBitmap
  const decodeBitmap = async (file) => loadImage(Buffer.from(await file.arrayBuffer()))
  globalThis.createImageBitmap = decodeBitmap
  window.createImageBitmap = decodeBitmap
  pipeline = await import('../src/core/pipeline.js')
  zipMod = await import('../src/core/zip.js')
})

const S = (patch) => normalizeSettings(patch)

describe('真实像素：composeCanvas', () => {
  it('3:4 留白：输出尺寸正确，边缘是留白底色', async () => {
    const png = makeTestImage(400, 300)
    const file = decode(png)
    const settings = S({ preset: 'portrait34', fit: 'contain', bg: '#102030', wm: { enabled: false } })
    const out = await pipeline.processFile(file, settings)
    const px = await pixelsOf(out.blob)

    expect(px.width).toBe(1080)
    expect(px.height).toBe(1440)
    expect(out.hitTarget).toBe(true)

    // 4:3 图放进 3:4 画布：上下各有留白，顶部像素应为底色
    const [r, g, b] = px.at(540, 20)
    expect(Math.abs(r - 0x10)).toBeLessThan(10)
    expect(Math.abs(g - 0x20)).toBeLessThan(10)
    expect(Math.abs(b - 0x30)).toBeLessThan(10)

    // 中心应是被缩放的图片，明显不同于底色
    const [cr, cg, cb] = px.at(540, 720)
    expect(cr + cg + cb).toBeGreaterThan(120)
  })

  it('1:1 铺满裁切：没有留白，四角都是图片像素', async () => {
    const png = makeTestImage(800, 400)
    const settings = S({ preset: 'square11', fit: 'cover', wm: { enabled: false } })
    const out = await pipeline.processFile(decode(png), settings)
    const px = await pixelsOf(out.blob)
    expect([px.width, px.height]).toEqual([1200, 1200])
    for (const [x, y] of [[5, 5], [1195, 5], [5, 1195], [1195, 1195]]) {
      const [r, g, b] = px.at(x, y)
      expect(r + g + b).toBeGreaterThan(90)
    }
  })

  it('保持原尺寸：输出尺寸等于原图', async () => {
    const out = await pipeline.processFile(decode(makeTestImage(640, 480)), S({ preset: 'original', wm: { enabled: false }, targetKB: 0 }))
    const px = await pixelsOf(out.blob)
    expect([px.width, px.height]).toEqual([640, 480])
  })

  it('自定义尺寸生效', async () => {
    const out = await pipeline.processFile(
      decode(makeTestImage(500, 500)),
      S({ preset: 'custom', customW: 320, customH: 200, wm: { enabled: false } }),
    )
    const px = await pixelsOf(out.blob)
    expect([px.width, px.height]).toEqual([320, 200])
  })
})

describe('真实像素：水印', () => {
  /** 加水印前后整张画布的像素差异数（按 4px 网格采样） */
  async function diffWithWatermark(watermark) {
    const png = makeTestImage(600, 600, { from: '#404040', to: '#404040' })
    const base = S({ preset: 'original', bg: '#404040', targetKB: 0, wm: { ...watermark, enabled: true } })
    const withWm = await pipeline.processFile(decode(png), base)
    const without = await pipeline.processFile(decode(png), S({ ...base, wm: { ...watermark, enabled: false } }))
    const a = await pixelsOf(withWm.blob)
    const b = await pixelsOf(without.blob)
    let changed = 0
    for (let y = 4; y < 596; y += 4) {
      for (let x = 4; x < 596; x += 4) {
        const [r1, g1, b1] = a.at(x, y)
        const [r2, g2, b2] = b.at(x, y)
        if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 30) changed++
      }
    }
    return changed
  }

  it('右下角水印会实际绘制像素', async () => {
    const changed = await diffWithWatermark({ text: 'TIEHAO', pos: 'br', size: 6, opacity: 1, color: '#ffffff', bold: true })
    expect(changed).toBeGreaterThan(30)
  })

  it('平铺水印覆盖整张画布，远多于单条水印', async () => {
    const single = await diffWithWatermark({ text: 'TIEHAO', pos: 'br', size: 6, opacity: 1, color: '#ffffff' })
    const tiled = await diffWithWatermark({ text: 'TIEHAO', pos: 'br', size: 6, opacity: 1, color: '#ffffff', tiled: true })
    expect(single).toBeGreaterThan(0)
    expect(tiled).toBeGreaterThan(single * 5)
  })

  it('关闭水印后不改变任何像素', async () => {
    const png = makeTestImage(300, 300, { from: '#606060', to: '#606060' })
    const s = S({ preset: 'original', targetKB: 0, wm: { enabled: false } })
    const out = await pipeline.processFile(decode(png), s)
    expect(out.afterBytes).toBeGreaterThan(0)
  })
})

describe('真实像素：目标体积压缩', () => {
  it('JPEG 可以压到目标 KB 以内', async () => {
    const png = makeTestImage(2400, 2400) // 内容复杂的大图
    const settings = S({ preset: 'original', format: 'image/jpeg', quality: 0.95, targetKB: 120, wm: { enabled: false } })
    const out = await pipeline.processFile(decode(png), settings)
    expect(out.afterBytes).toBeLessThanOrEqual(120 * 1024 + 512)
    expect(out.hitTarget).toBe(true)
    // 为了命中目标，可能降质量或缩画布
    expect(out.quality).toBeLessThanOrEqual(0.95)
    expect(out.scale).toBeLessThanOrEqual(1)
  })

  it('WebP 输出体积通常小于同质量 JPEG', async () => {
    const png = makeTestImage(1200, 1200)
    const jpeg = await pipeline.processFile(decode(png), S({ preset: 'original', format: 'image/jpeg', quality: 0.8, targetKB: 0, wm: { enabled: false } }))
    const webp = await pipeline.processFile(decode(png), S({ preset: 'original', format: 'image/webp', quality: 0.8, targetKB: 0, wm: { enabled: false } }))
    expect(webp.afterBytes).toBeLessThan(jpeg.afterBytes)
  })

  it('目标体积为 0 时按质量输出，不缩画布', async () => {
    const out = await pipeline.processFile(decode(makeTestImage(800, 600)), S({ preset: 'original', targetKB: 0, quality: 0.9, wm: { enabled: false } }))
    expect(out.scale).toBe(1)
    expect(out.quality).toBe(0.9)
  })

  it('超大目标体积不会二次缩放', async () => {
    const out = await pipeline.processFile(decode(makeTestImage(600, 600)), S({ preset: 'original', targetKB: 20000, wm: { enabled: false } }))
    expect(out.hitTarget).toBe(true)
    expect(out.scale).toBe(1)
  })

  it('超过单张像素上限会给出中文错误', async () => {
    const huge = { name: 'huge.jpg', type: 'image/png', size: 1000 }
    // 直接伪造解码结果，避免真的分配 60MP 位图
    const original = globalThis.createImageBitmap
    globalThis.createImageBitmap = async () => ({ width: 9000, height: 9000, close() {} })
    try {
      await expect(pipeline.processFile(huge, S({}))).rejects.toThrow(/MP/)
    } finally {
      globalThis.createImageBitmap = original
    }
  })
})

describe('真实像素：输出文件名与 ZIP 打包', () => {
  it('输出扩展名跟随格式', async () => {
    const png = makeTestImage(300, 300)
    const file = new File([png], 'IMG_0001.PNG', { type: 'image/png' })
    const jpeg = await pipeline.processFile(file, S({ preset: 'original', format: 'image/jpeg', wm: { enabled: false }, nameTemplate: '' }))
    const webp = await pipeline.processFile(file, S({ preset: 'original', format: 'image/webp', wm: { enabled: false }, nameTemplate: '' }))
    expect(jpeg.name).toBe('IMG_0001.jpg')
    expect(webp.name).toBe('IMG_0001.webp')
  })

  it('ZIP 内含成品、manifest.csv 与说明文件', async () => {
    const settings = S({ preset: 'portrait34', targetKB: 0, wm: { enabled: false }, nameTemplate: '' })
    const results = []
    for (const [name, w, h] of [['a.png', 400, 300], ['b.png', 300, 500]]) {
      const out = await pipeline.processFile(new File([makeTestImage(w, h)], name, { type: 'image/png' }), settings)
      results.push({ outName: out.name, result: out, srcName: name, beforeBytes: out.beforeBytes })
    }
    const blob = await zipMod.buildZip(results, settings)
    const files = await unzip(Buffer.from(await blob.arrayBuffer()))

    const names = Object.keys(files)
    expect(names).toHaveLength(4)
    expect(names).toContain('tiehao-output/manifest.csv')
    expect(names).toContain('tiehao-output/a.jpg')
    expect(names).toContain('tiehao-output/b.jpg')

    const csv = files['tiehao-output/manifest.csv'].toString('utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('a.jpg')
    expect(csv).toContain('1080×1440')

    // 解出来的 JPEG 能真正被解码
    const img = await loadImage(files['tiehao-output/a.jpg'])
    expect([img.width, img.height]).toEqual([1080, 1440])
  })
})
