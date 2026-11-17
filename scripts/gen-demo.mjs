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
const { processFile, processFileToTargets, composePreview } = await import('../src/core/pipeline.js')
const { makeSampleSource } = await import('../src/core/samples.js')
const { findPreset } = await import('../src/core/platforms.js')
const { encodeCanvas } = await import('../src/core/format.js').catch(() => ({}))

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

// —— 一图多版的对比图：同一张原图 → 三个平台规格并排
const multiSettings = normalizeSettings({
  targets: ['xiaohongshu', 'douyin', 'taobao-main'],
  fit: 'contain',
  bg: '#f6f1e8',
  format: 'image/jpeg',
  quality: 0.88,
  nameTemplate: '{name}-{platform}-{w}x{h}',
  wm: { enabled: true, text: '@tiehao.shop', pos: 'br', size: 3.2, opacity: 0.8, color: '#ffffff' },
})

const multiSource = await makeSampleSource(0, { lang: 'en' })
const multiFile = new File([multiSource], 'hero-shot.jpg', { type: 'image/jpeg' })
const multiTargets = multiSettings.targets.map(findPreset).filter(Boolean)
const outs = await processFileToTargets(multiFile, multiSettings, multiTargets, { index: 1 })
for (const { preset, result } of outs) {
  const buf = Buffer.from(await result.blob.arrayBuffer())
  const file = `multi-${preset.id}.jpg`
  fs.writeFileSync(path.join(OUT, file), buf)
  console.log(`✓ docs/${file}  ${result.width}×${result.height}  ${(buf.length / 1024).toFixed(0)}KB  · ${preset.platform} ${preset.name}`)
}

// —— 一张总览：把三个规格缩放到同高，横向拼起来，方便 README 一眼看懂
// 沙箱里只有 DejaVu 字体，中文标签会变豆腐块，总览统一用英文标注
const ASCII_PLATFORM = {
  '小红书': 'Xiaohongshu',
  '抖音': 'Douyin',
  '淘宝 / 天猫': 'Taobao / Tmall',
  '视频号': 'Channels',
}
const H = 520
const imgs = []
for (const { preset, result } of outs) {
  const buf = Buffer.from(await result.blob.arrayBuffer())
  const img = await loadImage(buf)
  imgs.push({
    img,
    w: Math.round((img.width / img.height) * H),
    h: H,
    label: (ASCII_PLATFORM[preset.platform] || preset.platform),
    size: `${preset.name.replace('图文', 'Post').replace('竖屏', 'Vertical').replace('主图', 'Main')} · ${preset.w}×${preset.h}`,
  })
}
const gap = 34
const labelH = 62
const TOP = 92
const totalW = imgs.reduce((a, b) => a + b.w, 0) + gap * (imgs.length + 1)
const totalH = TOP + H + gap + labelH
const sheet = createCanvas(totalW, totalH)
const sctx = sheet.getContext('2d')
sctx.fillStyle = '#f4efe6'
sctx.fillRect(0, 0, totalW, totalH)
sctx.fillStyle = '#3b3630'
sctx.font = '600 26px DejaVu Sans'
sctx.fillText('One upload \u2192 three platform sizes', gap, 50)
sctx.fillStyle = '#7d7368'
sctx.font = '16px DejaVu Sans'
sctx.fillText('Same source image, cropped and sized per platform by tiehao.', gap, 76)
let x = gap
for (const it of imgs) {
  sctx.drawImage(it.img, x, TOP, it.w, it.h)
  sctx.fillStyle = '#3b3630'
  sctx.font = '600 19px DejaVu Sans'
  sctx.fillText(it.label, x, TOP + H + 26)
  sctx.fillStyle = '#7d7368'
  sctx.font = '15px DejaVu Sans'
  sctx.fillText(it.size, x, TOP + H + 50)
  x += it.w + gap
}

fs.writeFileSync(path.join(OUT, 'multi-version-overview.jpg'), sheet.toBuffer('image/jpeg', 88))
console.log(`✓ docs/multi-version-overview.jpg  ${totalW}×${totalH}`)

// —— 白边裁剪前后：同一张图左侧原样、右侧裁掉白边
const padSource = (() => {
  const c = createCanvas(1000, 1000)
  const cx = c.getContext('2d')
  cx.fillStyle = '#ffffff'
  cx.fillRect(0, 0, 1000, 1000)
  const inner = createCanvas(520, 520)
  const ix = inner.getContext('2d')
  const g = ix.createLinearGradient(0, 0, 520, 520)
  g.addColorStop(0, '#c9a227')
  g.addColorStop(1, '#7a3b2e')
  ix.fillStyle = g
  ix.fillRect(0, 0, 520, 520)
  ix.fillStyle = 'rgba(255,255,255,.9)'
  ix.font = '700 64px DejaVu Sans'
  ix.fillText('PRODUCT', 40, 280)
  cx.drawImage(inner, 240, 240)
  return Buffer.from(c.toBuffer('image/jpeg', 92))
})()
const padFile = new File([new Uint8Array(padSource)], 'white-pad.jpg', { type: 'image/jpeg' })
const before = await processFile(padFile, normalizeSettings({
  preset: 'original', fit: 'contain', format: 'image/jpeg', quality: 0.9, trim: { enabled: false },
}))
const after = await processFile(padFile, normalizeSettings({
  preset: 'original', fit: 'contain', format: 'image/jpeg', quality: 0.9,
  trim: { enabled: true, tolerance: 14, pad: 0.02 },
}))
fs.writeFileSync(path.join(OUT, 'trim-before.jpg'), Buffer.from(await before.blob.arrayBuffer()))
fs.writeFileSync(path.join(OUT, 'trim-after.jpg'), Buffer.from(await after.blob.arrayBuffer()))
console.log(`✓ docs/trim-before.jpg  ${before.width}×${before.height}  →  docs/trim-after.jpg  ${after.width}×${after.height}`)

// —— 电商上架包：主图 + 白底图 + 详情页切片，验证真实卖家的完整流程
const listingSettings = normalizeSettings({
  targets: ['taobao-main', 'taobao-white', 'taobao-detail'],
  fit: 'contain',
  bg: '#f3ece1',
  format: 'image/jpeg',
  quality: 0.88,
  nameTemplate: '{name}-{platform}-{w}x{h}',
  wm: { enabled: true, text: '@tiehao.shop', pos: 'br', size: 3.4, opacity: 0.8, color: '#ffffff' },
})

// 详情页长图：750 宽、很高，里面的深色横条模拟文字行
const detailCanvas = createCanvas(750, 3600)
const dctx = detailCanvas.getContext('2d')
const dg = dctx.createLinearGradient(0, 0, 0, 3600)
dg.addColorStop(0, '#fbf7f0')
dg.addColorStop(1, '#efe3d2')
dctx.fillStyle = dg
dctx.fillRect(0, 0, 750, 3600)
dctx.fillStyle = '#c9a227'
dctx.fillRect(0, 0, 750, 220)
for (let y = 320; y < 3300; y += 420) {
  dctx.fillStyle = '#3b3630'
  dctx.fillRect(70, y, 430, 30)
  dctx.fillStyle = '#8d857a'
  dctx.fillRect(70, y + 56, 560, 20)
  dctx.fillRect(70, y + 92, 500, 20)
  dctx.fillStyle = 'rgba(201,162,39,.25)'
  dctx.fillRect(70, y + 150, 610, 180)
}
const detailFile = new File([new Uint8Array(detailCanvas.toBuffer('image/jpeg', 90))], 'detail-page.jpg', { type: 'image/jpeg' })

const listingFile = new File([multiSource], 'product-shot.jpg', { type: 'image/jpeg' })
const listingTargets = listingSettings.targets.map(findPreset).filter(Boolean)
const listingOut = await processFileToTargets(listingFile, listingSettings, listingTargets, { index: 1 })
for (const { preset, result } of listingOut) {
  const total = result.slices ? result.slices.reduce((a, sl) => a + sl.blob.size, 0) : result.blob.size
  console.log(`✓ ${preset.platform} ${preset.name}  ${result.width}×${result.height}  ${(total / 1024).toFixed(0)}KB${result.slices ? `  （切片 ${result.slices.length} 张）` : ''}`)
}

// 详情页切片单独跑一遍，输出首片做展示
const detailOut = await processFile(detailFile, listingSettings, { preset: findPreset('taobao-detail') })
for (const sl of detailOut.slices) {
  fs.writeFileSync(path.join(OUT, `detail-slice-${sl.index + 1}.jpg`), Buffer.from(await sl.blob.arrayBuffer()))
  console.log(`✓ docs/detail-slice-${sl.index + 1}.jpg  ${sl.width}×${sl.height}  ${(sl.blob.size / 1024).toFixed(0)}KB`)
}
// 白底图
const whiteOut = listingOut.find((o) => o.preset.id === 'taobao-white')
if (whiteOut) {
  fs.writeFileSync(path.join(OUT, 'taobao-white.jpg'), Buffer.from(await whiteOut.result.blob.arrayBuffer()))
  console.log(`✓ docs/taobao-white.jpg  ${whiteOut.result.width}×${whiteOut.result.height}`)
}
