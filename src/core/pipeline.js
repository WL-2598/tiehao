import { baseName, extForMime } from './format.js'
import {
  resolveCanvasSize,
  fitRect,
  watermarkPlacements,
  watermarkFontSpec,
  compressionPlan,
  scaleCanvas,
} from './canvas-plan.js'
import { normalizeCopy, copyIsActive, drawCopyLayer, toneColors } from './typography.js'
import { normalizeLogo, drawLogo, logoReady } from './logo.js'
import { trimCanvas, focusRect } from './trim.js'
import { safeWatermarkPlacements } from './canvas-plan.js'
import { buildOutputName, safeSlug, safeRect } from './platforms.js'

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

const WATERMARK_FAMILY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif'

export function drawWatermark(ctx, wm, W, H, layout = {}) {
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
  } else {
    // 没有描边时给一层极轻的柔光阴影：浅色底上的白水印也不会糊成一片
    ctx.shadowColor = 'rgba(0,0,0,0.34)'
    ctx.shadowBlur = Math.max(2, spec.px / 5)
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = Math.max(1, spec.px / 40)
  }
  const textWidth = ctx.measureText(text).width
  const placements = layout.box
    ? safeWatermarkPlacements({ text, textWidth, wm, W, H, box: layout.box, safe: layout.safe })
    : watermarkPlacements({ text, textWidth, wm, W, H })
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

/**
 * 计算白边裁剪框（原图坐标）。返回 null 表示不需要裁。
 * 独立导出便于在 processFile 里先据此决定输出尺寸。
 */
export function computeTrimCrop(source, srcW, srcH, trim) {
  if (!trim || !trim.enabled) return null
  const probe = document.createElement('canvas')
  probe.width = srcW
  probe.height = srcH
  probe.getContext('2d').drawImage(source, 0, 0, srcW, srcH)
  const trimmed = trimCanvas(probe, {
    bg: trim.bg || '#ffffff',
    tolerance: trim.tolerance ?? 14,
    pad: trim.pad ?? 0.02,
  })
  if (!trimmed.trimmed) return null
  const b = trimmed.box
  const sx = Math.max(0, Math.min(srcW - 1, Math.round(b.x)))
  const sy = Math.max(0, Math.min(srcH - 1, Math.round(b.y)))
  return {
    sx,
    sy,
    sw: Math.max(1, Math.min(srcW - sx, Math.round(b.w))),
    sh: Math.max(1, Math.min(srcH - sy, Math.round(b.h))),
  }
}

/**
 * 把源图合成到目标画布：焦点裁切 → 白边裁剪 → 文案层 → 水印 → 品牌标识。
 * opts.crop：外部已算好的裁剪框（避免重复探测）。
 * opts.srcSize：裁剪后的有效源尺寸，用于 fit 计算。
 * opts.logoImage 是已解码的 HTMLImageElement（异步解码在调用前完成）。
 */
export function composeCanvas(source, srcW, srcH, w, h, settings, opts = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const copy = settings.copy && copyIsActive(settings.copy) ? normalizeCopy(settings.copy) : null

  if (settings.fit === 'contain') {
    ctx.fillStyle = settings.bg
    ctx.fillRect(0, 0, w, h)
  }

  const crop = opts.crop !== undefined ? opts.crop : computeTrimCrop(source, srcW, srcH, settings.trim)
  const dw = crop ? crop.sw : srcW
  const dh = crop ? crop.sh : srcH

  // 把（可能已裁切的）源图按 fit 规则画进目标画布
  let drawnBox = null
  const drawInto = (target, srcWidth, srcHeight) => {
    const focus = settings.focus || { x: 0.5, y: 0.5 }
    const prefix = crop ? [source, crop.sx, crop.sy, crop.sw, crop.sh] : [source]
    const r = settings.fit === 'cover'
      ? focusRect(srcWidth, srcHeight, w, h, focus)
      : fitRect(srcWidth, srcHeight, w, h, 'contain')
    target.drawImage(...prefix, Math.round(r.dx), Math.round(r.dy), r.drawW, r.drawH)
    drawnBox = { x: Math.round(r.dx), y: Math.round(r.dy), w: r.drawW, h: r.drawH }
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawInto(ctx, dw, dh)

  // 安全区参考线（只用于预览叠加，不进入成品）
  if (opts.safeGuide && opts.preset) {
    const r = safeRect(opts.preset)
    ctx.save()
    ctx.strokeStyle = 'rgba(200,64,42,0.9)'
    ctx.setLineDash([Math.round(w * 0.012), Math.round(w * 0.008)])
    ctx.lineWidth = Math.max(2, Math.round(w * 0.003))
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.restore()
  }

  // 文案层（会自行处理遮挡与渐变）
  if (copy) drawCopyLayer(ctx, copy, w, h)

  // 文字水印
  if (settings.wm && settings.wm.enabled) {
    drawWatermark(ctx, settings.wm, w, h, {
      box: drawnBox,
      safe: opts.preset ? safeRect(opts.preset) : null,
    })
  }

  // 品牌标识
  if (settings.logo && logoReady(settings.logo)) {
    if (opts.logoImage) ctx.__logoImage = opts.logoImage
    const fam = copy ? WATERMARK_FAMILY : WATERMARK_FAMILY
    drawLogo(ctx, settings.logo, w, h, fam)
    delete ctx.__logoImage
  }

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

/** 解码用户上传的品牌 logo（data URL → Image），失败返回 null。 */
export async function decodeLogoImage(logo) {
  const l = normalizeLogo(logo)
  if (!l.enabled || l.mode !== 'image' || !l.imageDataUrl) return null
  try {
    const res = await fetch(l.imageDataUrl)
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob).catch(() => null)
    if (bmp) return bmp
    return await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = l.imageDataUrl
    })
  } catch {
    return null
  }
}

/**
 * 处理单张图片，按「一个目标规格」输出。
 * spec: { preset|null, w, h, fit, format, quality, targetKB }
 * opts: { maxMegapixels, logoImage, index, template, safeGuide }
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

    const spec = { ...settings, ...(opts.spec || {}) }
    const preset = opts.preset || null

    // 白边裁剪会改变「原图尺寸」：必须先把裁剪框算出来，
    // 否则「保持原尺寸」会把裁掉的留白又补回来
    const crop = computeTrimCrop(decoded.source, srcW, srcH, spec.trim)
    const effW = crop ? crop.sw : srcW
    const effH = crop ? crop.sh : srcH

    const { w, h } = preset
      ? { w: preset.w, h: preset.h }
      : resolveCanvasSize(spec, effW, effH)

    if (w * h > MAX_CANVAS_PIXELS) {
      throw new Error('输出画布过大，请把自定义尺寸调到 8000px 以内')
    }

    const canvas = composeCanvas(decoded.source, srcW, srcH, w, h, spec, {
      logoImage: opts.logoImage,
      safeGuide: opts.safeGuide,
      preset,
      crop,
    })
    const out = await encodeToTarget(canvas, spec)
    const ext = extForMime(spec.format)
    const platformLabel = preset ? preset.platform : ''
    const base = baseName(file.name || 'image')
    const template = opts.template || spec.nameTemplate
    const name = template
      ? buildOutputName(template, {
        name: base, platform: platformLabel, w: out.width, h: out.height, index: opts.index ?? 1, ext,
      })
      : `${base}.${ext}`

    return {
      name,
      blob: out.blob,
      width: out.width,
      height: out.height,
      quality: out.quality,
      scale: out.scale,
      hitTarget: out.hitTarget,
      beforeBytes: file.size,
      afterBytes: out.blob.size,
      canvas,
      presetId: preset?.id || null,
      platform: platformLabel,
      targetName: preset?.name || '',
    }
  } finally {
    decoded.dispose()
  }
}

/**
 * 一次合成、多目标输出：同一张原图导出 N 份规格。
 * 返回 [{ spec, result }]，失败的项带 error 但不会中断其它目标。
 */
export async function processFileToTargets(file, settings, targets, opts = {}) {
  const results = []
  for (let i = 0; i < targets.length; i += 1) {
    const preset = targets[i]
    try {
      const result = await processFile(file, settings, {
        ...opts,
        preset,
        index: (opts.index ?? 1) + i,
      })
      results.push({ preset, result })
    } catch (err) {
      results.push({ preset, error: err.message })
    }
  }
  return results
}

/** 仅合成预览（不压缩），返回画布与尺寸。 */
export async function composePreview(file, settings, opts = {}) {
  const decoded = await decodeImage(file)
  try {
    const preset = opts.preset || null
    const crop = computeTrimCrop(decoded.source, decoded.width, decoded.height, settings.trim)
    const effW = crop ? crop.sw : decoded.width
    const effH = crop ? crop.sh : decoded.height
    const { w, h } = preset
      ? { w: preset.w, h: preset.h }
      : resolveCanvasSize(settings, effW, effH)
    const logoImage = opts.logoImage !== undefined ? opts.logoImage : await decodeLogoImage(settings.logo)
    const canvas = composeCanvas(decoded.source, decoded.width, decoded.height, w, h, settings, {
      logoImage,
      safeGuide: opts.safeGuide,
      preset,
      crop,
    })
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
