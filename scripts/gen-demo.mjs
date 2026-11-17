/**
 * 用真实管线生成产品展示素材（不出现在网页里，仅用于 README / 商店页截图）。
 * 运行：node scripts/gen-demo.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'docs')

// —— 浏览器 API 的最小替身，让 src/core/pipeline.js 能在 Node 里跑
const urlMap = new Map()
let seq = 0
URL.createObjectURL = (blob) => {
  const url = `blob:demo-${++seq}`
  urlMap.set(url, blob)
  return url
}
URL.revokeObjectURL = () => {}
globalThis.createImageBitmap = async (file) => {
  let img
  try {
    img = await loadImage(Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    console.error('[demo] 解码失败：', err.message)
    throw err
  }
  // @napi-rs/canvas 的 Image 可直接被 drawImage 绘制；
  // 原生对象不能挂 close 属性（模块化严格模式下会抛错），用 WeakSet 记录
  decoded.add(img)
  return img
}
const decoded = new WeakSet()
globalThis.HTMLCanvasElement = class {}
HTMLCanvasElement.prototype.getContext = function () { return this.__native.getContext('2d') }
globalThis.document = globalThis.document || {}
document.createElement = () => {
  const native = createCanvas(1, 1)
  const el = {
    __native: native,
    get width() { return native.width },
    set width(v) { native.width = v },
    get height() { return native.height },
    set height(v) { native.height = v },
    getContext: (t) => native.getContext(t),
    toBlob: (cb, mime, q) => {
      const fmt = mime === 'image/jpeg' ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png'
      const buf = native.toBuffer(fmt, q == null ? 80 : Math.round(q * 100))
      cb(new Blob([new Uint8Array(buf)], { type: mime }))
    },
  }
  return el
}

const { normalizeSettings } = await import('../src/core/settings.js')
const { processFile } = await import('../src/core/pipeline.js')
const { makeSampleSource } = await import('../src/core/samples.js')

fs.mkdirSync(OUT, { recursive: true })

const specs = [
  { name: 'demo-34.jpg', preset: 'portrait34', label: '3:4 竖版 1080×1440' },
  { name: 'demo-11.jpg', preset: 'square11', label: '1:1 方图 1200×1200' },
  { name: 'demo-916.jpg', preset: 'vertical916', label: '9:16 竖屏 1080×1920' },
]

for (const [i, spec] of specs.entries()) {
  const source = await makeSampleSource(i, { lang: 'en' })
  const file = new File([source], `sample-${i}.jpg`, { type: 'image/jpeg' })
  const settings = normalizeSettings({
    preset: spec.preset,
    fit: i === 1 ? 'cover' : 'contain',
    bg: '#f6f1e8',
    format: 'image/jpeg',
    quality: 0.86,
    targetKB: 420,
    wm: { enabled: true, text: '@tiehao.shop', pos: 'br', size: 3.6, opacity: 0.85, color: '#ffffff' },
  })
  const out = await processFile(file, settings)
  const buf = Buffer.from(await out.blob.arrayBuffer())
  fs.writeFileSync(path.join(OUT, spec.name), buf)
  console.log(`✓ docs/${spec.name}  ${out.width}×${out.height}  ${(buf.length / 1024).toFixed(0)}KB  · ${spec.label}`)
}
