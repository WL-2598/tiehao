import { clamp } from './format.js'
import { CANVAS_PRESETS, WM_FONTS } from './settings.js'

/** 计算输出画布尺寸。 */
export function resolveCanvasSize(settings, srcW, srcH) {
  const preset = CANVAS_PRESETS.find((p) => p.id === settings.preset) || CANVAS_PRESETS[0]
  if (preset.id === 'original') {
    return { w: Math.max(1, Math.round(srcW)), h: Math.max(1, Math.round(srcH)), presetId: preset.id }
  }
  if (preset.id === 'custom') {
    return {
      w: clamp(Math.round(settings.customW) || 1080, 16, 8000),
      h: clamp(Math.round(settings.customH) || 1440, 16, 8000),
      presetId: preset.id,
    }
  }
  return { w: preset.w, h: preset.h, presetId: preset.id }
}

/** 原图在画布上的绘制区域。contain 留白居中，cover 铺满居中。 */
export function fitRect(srcW, srcH, dstW, dstH, fit) {
  const scale = fit === 'cover'
    ? Math.max(dstW / srcW, dstH / srcH)
    : Math.min(dstW / srcW, dstH / srcH)
  const drawW = Math.max(1, Math.round(srcW * scale))
  const drawH = Math.max(1, Math.round(srcH * scale))
  return {
    drawW,
    drawH,
    dx: Math.round((dstW - drawW) / 2),
    dy: Math.round((dstH - drawH) / 2),
    scale,
  }
}

export function watermarkFont(wm) {
  const def = WM_FONTS.find((f) => f.id === wm.font) || WM_FONTS[0]
  const weight = wm.bold ? 700 : def.weight || 400
  return `${weight} ${def.stack}`
}

export function watermarkFontSpec(wm, W) {
  const def = WM_FONTS.find((f) => f.id === wm.font) || WM_FONTS[0]
  const weight = wm.bold ? 700 : def.weight || 400
  const px = clamp(Math.round((W * wm.size) / 100), 8, Math.max(12, Math.round(W * 0.5)))
  return { px, weight, stack: def.stack, css: `${weight} ${px}px ${def.stack}` }
}

/**
 * 计算水印放置位置。textWidth 由调用方用同一字体测量，保证平铺间距准确。
 * 返回 [{x, y, align, baseline, rotate}]，坐标相对于画布左上角。
 */
export function watermarkPlacements({ text, textWidth, wm, W, H }) {
  const { px } = watermarkFontSpec(wm, W)
  const margin = Math.max(8, Math.round(Math.min(W, H) * 0.035))
  const tw = Math.max(textWidth, 1)

  if (wm.tiled) {
    const rotate = -25 * (Math.PI / 180)
    const stepX = Math.max(tw * 1.7, px * 2.5)
    const stepY = px * 4.2
    const out = []
    let row = 0
    for (let y = -H * 0.4; y < H * 1.4; y += stepY, row += 1) {
      const offset = row % 2 ? stepX / 2 : 0
      for (let x = -W * 0.4 + offset; x < W * 1.4; x += stepX) {
        out.push({ x, y, align: 'center', baseline: 'middle', rotate })
      }
    }
    return out
  }

  const pad = margin
  switch (wm.pos) {
    case 'tl': return [{ x: pad, y: pad, align: 'left', baseline: 'top', rotate: 0 }]
    case 'tr': return [{ x: W - pad, y: pad, align: 'right', baseline: 'top', rotate: 0 }]
    case 'bl': return [{ x: pad, y: H - pad, align: 'left', baseline: 'bottom', rotate: 0 }]
    case 'center': return [{ x: W / 2, y: H / 2, align: 'center', baseline: 'middle', rotate: 0 }]
    case 'br':
    default: return [{ x: W - pad, y: H - pad, align: 'right', baseline: 'bottom', rotate: 0 }]
  }
}

/**
 * 目标体积压缩的候选步骤：先降质量，仍超标再按比例缩小画布。
 * 返回按顺序尝试的 [{quality, scale}]，调用方取第一个达标结果。
 */
export function compressionPlan({ quality = 0.85, targetBytes = 0, minQuality = 0.35, minScale = 0.5 } = {}) {
  const q = clamp(quality, 0.1, 1)
  const qualitySteps = [q]
  for (const s of [0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35]) {
    if (s < q - 1e-6 && s >= minQuality - 1e-6) qualitySteps.push(s)
  }
  if (minQuality < qualitySteps[qualitySteps.length - 1] - 1e-6) qualitySteps.push(minQuality)

  const steps = qualitySteps.map((quality2) => ({ quality: quality2, scale: 1 }))
  if (targetBytes > 0) {
    for (const scale of [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
      if (scale >= minScale - 1e-6) steps.push({ quality: minQuality, scale })
    }
  }
  return steps
}

/** 画布缩放（用于压缩兜底），返回新画布。 */
export function scaleCanvas(canvas, scale) {
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, w, h)
  return c
}
