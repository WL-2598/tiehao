/**
 * 白边裁剪与主体居中：电商图常见需求。
 * 纯像素算法，在离屏小画布上扫描，避免大图逐像素拖慢主线程。
 */

import { fitRect } from './canvas-plan.js'

/** 像素是否接近目标底色（容差 0-255）。 */
function isBg(data, i, bg, tol) {
  return (
    Math.abs(data[i] - bg[0]) <= tol &&
    Math.abs(data[i + 1] - bg[1]) <= tol &&
    Math.abs(data[i + 2] - bg[2]) <= tol
  )
}

function hexToRgb(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex || '')
  const n = m ? parseInt(m[1], 16) : 0xffffff
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 计算非底色内容的包围盒。
 * @returns {{x:number,y:number,w:number,h:number}|null} 按原图坐标返回；全图都是底色时返回 null
 */
export function contentBounds(imageData, opts = {}) {
  const { width, height, data } = imageData
  const bg = opts.bg ? hexToRgb(opts.bg) : null
  const tol = Math.round(opts.tolerance ?? 12)

  let minX = width, minY = height, maxX = -1, maxY = -1

  // 从四条边向内扫描：先找到第一行/列不是底色的位置
  const rowHasContent = (y) => {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 8) continue // 透明像素不算内容
      if (!bg || !isBg(data, i, bg, tol)) return true
    }
    return false
  }
  const colHasContent = (x) => {
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 8) continue
      if (!bg || !isBg(data, i, bg, tol)) return true
    }
    return false
  }

  for (let y = 0; y < height; y += 1) if (rowHasContent(y)) { minY = y; break }
  for (let y = height - 1; y >= 0; y -= 1) if (rowHasContent(y)) { maxY = y; break }
  for (let x = 0; x < width; x += 1) if (colHasContent(x)) { minX = x; break }
  for (let x = width - 1; x >= 0; x -= 1) if (colHasContent(x)) { maxX = x; break }

  if (maxX < 0 || maxY < 0 || minX >= width || minY >= height) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * 在 canvas 上做白边裁剪，返回裁剪后的 canvas 与新尺寸。
 * pad：裁剪后额外留出的比例留白（0-0.2）。
 */
export function trimCanvas(canvas, opts = {}) {
  const scale = Math.min(1, 900 / Math.max(canvas.width, canvas.height))
  const sw = Math.max(1, Math.round(canvas.width * scale))
  const sh = Math.max(1, Math.round(canvas.height * scale))

  const probe = document.createElement('canvas')
  probe.width = sw
  probe.height = sh
  const pctx = probe.getContext('2d')
  // 某些实现（如测试环境）里传入的 canvas 是包装对象，先落到原生可绘制对象
  pctx.drawImage(canvas.__native || canvas, 0, 0, sw, sh)

  let bounds
  try {
    bounds = contentBounds(pctx.getImageData(0, 0, sw, sh), {
      bg: opts.bg,
      tolerance: opts.tolerance ?? 14,
    })
  } catch {
    return { canvas, trimmed: false, reason: '无法读取像素（可能被跨域限制）' }
  }
  if (!bounds) return { canvas, trimmed: false, reason: '整张图都是底色' }

  // 还原到原图坐标
  const inv = 1 / scale
  const pad = Math.round(Math.min(canvas.width, canvas.height) * (opts.pad ?? 0.02))
  let x = Math.max(0, Math.floor(bounds.x * inv) - pad)
  let y = Math.max(0, Math.floor(bounds.y * inv) - pad)
  let w = Math.min(canvas.width - x, Math.ceil(bounds.w * inv) + pad * 2)
  let h = Math.min(canvas.height - y, Math.ceil(bounds.h * inv) + pad * 2)

  // 已经贴合（误差 2% 内）就不裁
  const covered = (w * h) / (canvas.width * canvas.height)
  if (covered > 0.98) return { canvas, trimmed: false, reason: '四周没有可裁的留白' }

  // 保持比例不被拉伸：不强制正方形，直接按包围盒裁
  const out = document.createElement('canvas')
  out.width = Math.max(1, w)
  out.height = Math.max(1, h)
  out.getContext('2d').drawImage(canvas.__native || canvas, x, y, w, h, 0, 0, w, h)
  return {
    canvas: out,
    trimmed: true,
    ratio: covered,
    box: { x, y, w, h },
  }
}

/**
 * 主体居中：把包围盒的中心对齐到画布中心，返回偏移建议。
 * 供「裁切构图微调」使用（panel 中心偏移量，-1..1）。
 */
export function centerOffset(imageData, opts = {}) {
  const b = contentBounds(imageData, opts)
  if (!b) return { dx: 0, dy: 0 }
  const { width, height } = imageData
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return {
    dx: (width / 2 - cx) / width,
    dy: (height / 2 - cy) / height,
  }
}

/** 根据焦点位置算 cover 时的绘制偏移（代替死板的居中裁切）。 */
export function focusRect(srcW, srcH, dstW, dstH, focus = { x: 0.5, y: 0.5 }) {
  const r = fitRect(srcW, srcH, dstW, dstH, 'cover')
  const fx = Math.min(1, Math.max(0, focus.x ?? 0.5))
  const fy = Math.min(1, Math.max(0, focus.y ?? 0.5))
  // 图片比画布大出来的部分，按焦点分配裁切量
  const overflowX = r.drawW - dstW
  const overflowY = r.drawH - dstH
  return {
    drawW: r.drawW,
    drawH: r.drawH,
    dx: -Math.round(overflowX * fx),
    dy: -Math.round(overflowY * fy),
  }
}
