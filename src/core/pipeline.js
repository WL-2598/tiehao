import { baseName, extForMime } from './format.js'
import {
  resolveCanvasSize,
  fitRect,
  watermarkPlacements,
  watermarkFontSpec,
  compressionPlan,
  scaleCanvas,
} from './canvas-plan.js'

const MAX_CANVAS_PIXELS = 64_000_000

/** 深色/浅色水印配对比描边色，保证在复杂背景上可读。 */
function strokeColorFor(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return 'rgba(0,0,0,0.4)'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.5)'
}

export function drawWatermark(ctx, wm, W, H) {
  const text = String(wm.text || '').trim()
  if (!text) return
  const spec = watermarkFontSpec(wm, W)
  ctx.save()
  ctx.font = spec.css
  ctx.globalAlpha = Number(wm.opacity)
  ctx.fillStyle = wm.color
  ctx.lineJoin = 'round'
  if (wm.stroke) {
    ctx.lineWidth = Math.max(1, spec.px / 14)
    ctx.strokeStyle = strokeColorFor(wm.color)
  }
  const textWidth = ctx.measureText(text).width
  const placements = watermarkPlacements({ text, textWidth, wm, W, H })
  for (const p of placements) {
    ctx.save()
    ctx.translate(p.x, p.y)
    if (p.rotate) ctx.rotate(p.rotate)
    ctx.textAlign = p.align
    ctx.textBaseline = p.baseline
    if (wm.stroke) ctx.strokeText(text, 0, 0)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

/** 解码图片为可绘制源，自动应用 EXIF 方向（浏览器支持时）。 */
export async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close?.(),
      }
    } catch { /* 继续走 HTMLImageElement 方案 */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('图片解码失败，可能是不支持的格式'))
      el.src = url
    })
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/** 把源图合成到目标画布：填充 / 裁切 + 水印。 */
export function composeCanvas(source, srcW, srcH, w, h, settings) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (settings.fit === 'contain') {
    ctx.fillStyle = settings.bg
    ctx.fillRect(0, 0, w, h)
  }
  const r = fitRect(srcW, srcH, w, h, settings.fit)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, r.dx, r.dy, r.drawW, r.drawH)
  if (settings.wm && settings.wm.enabled) drawWatermark(ctx, settings.wm, w, h)
  return canvas
}

function encode(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('浏览器编码失败，请改用 JPEG 或 WebP 输出'))),
      mime,
      quality,
    )
  })
}

/**
 * 按设置编码；JPEG/WebP 会在质量与画布比例之间寻找满足目标 KB 的结果。
 * PNG 忽略目标体积（无损格式无质量参数）。
 */
export async function encodeToTarget(canvas, settings) {
  const mime = settings.format
  const targetBytes = mime === 'image/png' ? 0 : Math.max(0, Number(settings.targetKB) || 0) * 1024
  const plan = compressionPlan({ quality: settings.quality, targetBytes })
  let last = null
  for (const step of plan) {
    const c = step.scale === 1 ? canvas : scaleCanvas(canvas, step.scale)
    const blob = await encode(c, mime, step.quality)
    last = {
      blob,
      width: c.width,
      height: c.height,
      quality: step.quality,
      scale: step.scale,
      hitTarget: !targetBytes || blob.size <= targetBytes,
    }
    if (last.hitTarget) return last
  }
  return last
}

/**
 * 处理单张图片，返回可打包的结果。
 * opts: { maxMegapixels = 40 }
 */
export async function processFile(file, settings, opts = {}) {
  const decoded = await decodeImage(file)
  try {
    const srcW = decoded.width
    const srcH = decoded.height
    const maxMp = opts.maxMegapixels || 40
    const mp = (srcW * srcH) / 1e6
    if (mp > maxMp) {
      throw new Error(`图片 ${mp.toFixed(1)}MP，超过单张 ${maxMp}MP 上限`)
    }
    const { w, h } = resolveCanvasSize(settings, srcW, srcH)
    if (w * h > MAX_CANVAS_PIXELS) {
      throw new Error('输出画布过大，请把自定义尺寸调到 8000px 以内')
    }
    const canvas = composeCanvas(decoded.source, srcW, srcH, w, h, settings)
    const out = await encodeToTarget(canvas, settings)
    const ext = extForMime(settings.format)
    return {
      name: `${baseName(file.name || 'image')}.${ext}`,
      blob: out.blob,
      width: out.width,
      height: out.height,
      quality: out.quality,
      scale: out.scale,
      hitTarget: out.hitTarget,
      beforeBytes: file.size,
      afterBytes: out.blob.size,
      canvas,
    }
  } finally {
    decoded.dispose()
  }
}

/** 仅合成预览（不压缩），返回画布与尺寸。 */
export async function composePreview(file, settings) {
  const decoded = await decodeImage(file)
  try {
    const { w, h } = resolveCanvasSize(settings, decoded.width, decoded.height)
    const canvas = composeCanvas(decoded.source, decoded.width, decoded.height, w, h, settings)
    return { canvas, width: w, height: h }
  } finally {
    decoded.dispose()
  }
}

export function canvasToURL(canvas, mime = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('预览生成失败'))
        resolve(URL.createObjectURL(blob))
      },
      mime,
      quality,
    )
  })
}
