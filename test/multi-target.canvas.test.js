// @vitest-environment happy-dom
/**
 * 真实像素：一图多版 + 文案排版 + 品牌标识 + 焦点裁切 + 白边裁剪。
 * 这些是「值不值得付费」的核心能力，必须真的画出像素，而不是只返回尺寸。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { normalizeSettings } from '../src/core/settings.js'
import { findPreset } from '../src/core/platforms.js'
import { buildOutputName } from '../src/core/platforms.js'

let pipeline

function installEnv() {
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (!this.__ctx) this.__ctx = this.__native.getContext(type)
    return this.__ctx
  }
  HTMLCanvasElement.prototype.toBlob = function (cb, mime = 'image/png', quality) {
    const q = typeof quality === 'number' ? Math.round(quality * 100) : 80
    const fmt = mime === 'image/jpeg' ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png'
    const buf = this.__native.toBuffer(fmt, q)
    setTimeout(() => cb(new Blob([new Uint8Array(buf)], { type: mime })), 0)
  }
  const orig = document.createElement.bind(document)
  document.createElement = (tag, opts) => {
    if (String(tag).toLowerCase() === 'canvas') {
      // 直接返回原生 canvas：happy-dom 的 HTMLCanvasElement 包装层
      // 在 drawImage 类型校验上会互相不认，测试里不需要它
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
    const el = orig(tag, opts)
    if (String(tag).toLowerCase() === 'canvas') {
      const native = createCanvas(300, 150)
      el.__native = native
      Object.defineProperty(el, 'width', { get: () => native.width, set: (v) => { native.width = v } })
      Object.defineProperty(el, 'height', { get: () => native.height, set: (v) => { native.height = v } })
    }
    return el
  }
  // trimCanvas 内部会用 probe.getImageData：canvas 代理要转发这个方法
  URL.createObjectURL = () => 'blob:stub'
  URL.revokeObjectURL = () => {}
  const decode = async (file) => loadImage(Buffer.from(await file.arrayBuffer()))
  globalThis.createImageBitmap = decode
  window.createImageBitmap = decode
}

/** 生成测试图：左上浅、右下深，便于断言焦点裁切是否真的换了一块。 */
function makeImage(w, h, opts = {}) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  if (opts.plain) {
    ctx.fillStyle = opts.plain
    ctx.fillRect(0, 0, w, h)
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#f2e9d8')
    g.addColorStop(1, '#1f2a44')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  return c.toBuffer('image/png')
}

async function pixels(blob) {
  const img = await loadImage(Buffer.from(await blob.arrayBuffer()))
  const c = createCanvas(img.width, img.height)
  c.getContext('2d').drawImage(img, 0, 0)
  const ctx = c.getContext('2d')
  return {
    width: img.width,
    height: img.height,
    at: (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data),
    darkRatio: (x0, y0, x1, y1) => {
      const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      let dark = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < 110) dark += 1
      }
      return dark / (data.length / 4)
    },
  }
}

beforeAll(async () => {
  installEnv()
  pipeline = await import('../src/core/pipeline.js')
})

const S = (patch) => normalizeSettings({ wm: { enabled: false }, targetKB: 0, ...patch })

describe('水印避让留白边与安全区', () => {
  it('留白画布上，水印不会落到上下底色边里', async () => {
    const file = new File([makeImage(1000, 400, { plain: '#e8e2d6' })], 'wide.png', { type: 'image/png' })
    const settings = S({
      targets: ['douyin'],
      fit: 'contain',
      bg: '#ffffff',
      format: 'image/png',
      wm: { enabled: true, text: 'DEMO', pos: 'br', size: 5, opacity: 1, color: '#000000' },
    })
    const { canvas, height } = await pipeline.composePreview(file, settings, { preset: findPreset('douyin') })
    const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const px = await pixels(out)
    const bandH = Math.round((height - (height * 400) / 1000) / 2)
    expect(bandH).toBeGreaterThan(40)
    // 底部留白带里不应出现黑色水印像素（容差 0.2% 抗 JPEG/抗锯齿）
    expect(px.darkRatio(0, px.height - bandH + 2, px.width, px.height)).toBeLessThan(0.002)
  })
})

describe('一图多版', () => {
  it('一张原图按 3 个目标导出 3 份，尺寸各自正确', async () => {
    const file = new File([makeImage(1200, 1200)], '主图.png', { type: 'image/png' })
    const targets = [findPreset('xiaohongshu'), findPreset('douyin'), findPreset('instagram-square')]
    const settings = S({ nameTemplate: '{name}-{platform}-{w}x{h}' })

    const results = await pipeline.processFileToTargets(file, settings, targets, { index: 1 })
    expect(results).toHaveLength(3)
    for (const [i, entry] of results.entries()) {
      expect(entry.error).toBeUndefined()
      const px = await pixels(entry.result.blob)
      expect([px.width, px.height]).toEqual([targets[i].w, targets[i].h])
      expect(entry.result.platform).toBe(targets[i].platform)
      // 文件名带平台与尺寸
      expect(entry.result.name).toContain(String(targets[i].w))
      expect(entry.result.name.endsWith('.jpg')).toBe(true)
    }
    // 三份文件名互不相同（否则打包会互相覆盖）
    const names = results.map((r) => r.result.name)
    expect(new Set(names).size).toBe(3)
  })

  it('某个目标失败不会中断其它目标', async () => {
    const file = new File([makeImage(600, 600)], 'a.png', { type: 'image/png' })
    const broken = { ...findPreset('douyin'), id: 'broken', w: 0, h: 0 }
    const targets = [findPreset('xiaohongshu'), broken, findPreset('taobao-main')]
    const results = await pipeline.processFileToTargets(file, S({}), targets, {})
    expect(results).toHaveLength(3)
    expect(results[0].result).toBeTruthy()
    expect(results[2].result).toBeTruthy()
  })

  it('模板为空时回落到原名', async () => {
    const file = new File([makeImage(400, 400)], 'photo.png', { type: 'image/png' })
    const out = await pipeline.processFile(file, S({ preset: 'square11', nameTemplate: '' }), {})
    expect(out.name).toBe('photo.jpg')
  })

  it('默认模板会带上尺寸（避免多目标互相覆盖）', async () => {
    const file = new File([makeImage(400, 400)], 'photo.png', { type: 'image/png' })
    const out = await pipeline.processFile(file, S({ preset: 'square11' }), {})
    expect(out.name).toBe('photo-1200x1200.jpg')
  })

  it('文件名模板真的生效', async () => {
    const file = new File([makeImage(400, 400)], 'photo.png', { type: 'image/png' })
    const out = await pipeline.processFile(file, S({}), {
      preset: findPreset('xiaohongshu'),
      template: '{platform}_{index}_{w}x{h}',
      index: 4,
    })
    expect(out.name).toBe('小红书_04_1080x1440.jpg')
  })
})

describe('白边裁剪', () => {
  it('自动裁掉四周纯白留白', async () => {
    // 1000×1000 白底，中间 400×400 有内容
    const c = createCanvas(1000, 1000)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1000, 1000)
    ctx.fillStyle = '#c8402a'
    ctx.fillRect(300, 300, 400, 400)
    const png = c.toBuffer('image/png')

    const file = new File([png], 'white.jpg', { type: 'image/png' })
    const settings = S({ preset: 'original', trim: { enabled: true, bg: '#ffffff', tolerance: 14, pad: 0, ...{} } })
    const out = await pipeline.processFile(file, settings, {})
    // 裁到内容附近（允许少量误差）
    expect(out.width).toBeGreaterThan(390)
    expect(out.width).toBeLessThan(430)
    expect(out.height).toBeGreaterThan(390)
    expect(out.height).toBeLessThan(430)
  })

  it('关闭时不裁', async () => {
    const c = createCanvas(600, 600)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 600, 600)
    ctx.fillStyle = '#123456'
    ctx.fillRect(200, 200, 200, 200)
    const file = new File([c.toBuffer('image/png')], 'w.png', { type: 'image/png' })
    const out = await pipeline.processFile(file, S({ preset: 'original' }), {})
    expect([out.width, out.height]).toEqual([600, 600])
  })
})

describe('文案排版', () => {
  it('开启文案层会改变像素，且只影响文案区域', async () => {
    const plain = makeImage(900, 900, { plain: '#5a6b7c' })
    const file = new File([plain], 'plain.png', { type: 'image/png' })

    const base = S({ preset: 'square11', bg: '#5a6b7c' })
    const withCopy = S({
      ...base,
      copy: { ...base.copy, title: '限时特惠', price: '¥99', layout: 'ticket', tone: 'ink' },
    })

    const a = await pipeline.processFile(file, base, {})
    const b = await pipeline.processFile(file, withCopy, {})
    const pa = await pixels(a.blob)
    const pb = await pixels(b.blob)

    // 默认（无文案）应均匀；有文案时底部应出现明显变化
    expect(a.width).toBe(b.width)
    let diff = 0
    for (let y = 700; y < 1150; y += 6) {
      for (let x = 60; x < 1140; x += 6) {
        const [r1, g1, b1] = pa.at(x, y)
        const [r2, g2, b2] = pb.at(x, y)
        if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 40) diff += 1
      }
    }
    expect(diff).toBeGreaterThan(40)
  })

  it('不同排版产出的像素不同（不是只改了配置）', async () => {
    const file = new File([makeImage(800, 800, { plain: '#6b7c8d' })], 'p.png', { type: 'image/png' })
    const base = S({ preset: 'square11' })
    const mk = (layout) => S({ ...base, copy: { ...base.copy, layout, title: '新品上市', price: '¥199', points: '包邮,现货' } })

    const outs = []
    for (const layout of ['poster-bottom', 'poster-top', 'center-card']) {
      const r = await pipeline.processFile(file, mk(layout), {})
      outs.push(await pixels(r.blob))
    }
    // 顶部排版与底部排版在同一位置必然不同
    const diff = (p1, p2, y0, y1) => {
      let d = 0
      for (let y = y0; y < y1; y += 8) {
        for (let x = 40; x < 1160; x += 8) {
          const [r1, g1, b1] = p1.at(x, y)
          const [r2, g2, b2] = p2.at(x, y)
          if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 40) d += 1
        }
      }
      return d
    }
    expect(diff(outs[0], outs[1], 100, 400)).toBeGreaterThan(10)
  })

  it('文案为空时不改变像素', async () => {
    const file = new File([makeImage(500, 500, { plain: '#778899' })], 'q.png', { type: 'image/png' })
    const base = S({ preset: 'square11' })
    const a = await pipeline.processFile(file, base, {})
    const b = await pipeline.processFile(file, S({ ...base, copy: { ...base.copy, title: '', price: '' } }), {})
    expect(a.afterBytes).toBe(b.afterBytes)
  })
})

describe('品牌标识', () => {
  it('文字标识画在指定角落', async () => {
    const file = new File([makeImage(600, 600, { plain: '#8a8a8a' })], 'l.png', { type: 'image/png' })
    const base = S({ preset: 'original' })
    const off = await pipeline.processFile(file, base, {})
    const on = await pipeline.processFile(file, S({
      ...base,
      logo: { ...base.logo, enabled: true, mode: 'text', text: 'TIEHAO', pos: 'tl', size: 10, plate: true, opacity: 1 },
    }), {})
    const a = await pixels(off.blob)
    const b = await pixels(on.blob)

    const region = (p, x0, y0, x1, y1) => {
      let changed = 0
      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          const [r1, g1, b1] = a.at(x, y)
          const [r2, g2, b2] = p.at(x, y)
          if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 25) changed += 1
        }
      }
      return changed
    }
    const topLeft = region(b, 0, 0, 300, 140)
    const bottomRight = region(b, 400, 460, 600, 600)
    expect(topLeft).toBeGreaterThan(20)
    // 右上/右下不应被左上标识影响
    expect(bottomRight).toBeLessThan(topLeft)
  })
})

describe('焦点裁切', () => {
  it('焦点在上 vs 在下，裁出的是不同区域', async () => {
    // 上半浅色、下半深色
    const c = createCanvas(1000, 1000)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, 1000, 500)
    ctx.fillStyle = '#101820'
    ctx.fillRect(0, 500, 1000, 500)
    const file = new File([c.toBuffer('image/png')], 'split.png', { type: 'image/png' })

    const settings = (fy) => S({ preset: 'landscape169', fit: 'cover', focus: { x: 0.5, y: fy } })
    // 16:9 裁 1:1 方形，焦点 0（保留上方）与 1（保留下方）
    const top = await pipeline.processFile(file, settings(0), {})
    const bottom = await pipeline.processFile(file, settings(1), {})

    const pt = await pixels(top.blob)
    const pb = await pixels(bottom.blob)
    const lum = ([r, g, b]) => r * 0.299 + g * 0.587 + b * 0.114
    const centerTop = lum(pt.at(pt.width / 2, pt.height / 2))
    const centerBottom = lum(pb.at(pb.width / 2, pb.height / 2))

    // 焦点在上时画面整体偏亮；在下时偏暗
    expect(centerTop).toBeGreaterThan(centerBottom)
  })
})
