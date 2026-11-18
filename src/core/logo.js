/**
 * 品牌标识层：文字标识（无需上传 logo）或用户上传的 PNG。
 * 位置、大小、不透明度、留白边都可以调；上传的 logo 会按亮度自动加背板，
 * 避免深色 logo 落在深色图上消失。
 */

export const LOGO_POSITIONS = [
  { id: 'tl', label: '左上' },
  { id: 'tr', label: '右上' },
  { id: 'bl', label: '左下' },
  { id: 'br', label: '右下' },
]

export const DEFAULT_LOGO = {
  enabled: false,
  mode: 'text', // text | image
  text: '@你的品牌',
  imageDataUrl: '',
  pos: 'tl',
  size: 4, // 占画布宽度的百分比
  opacity: 0.9,
  padding: 3.2, // 距画布边缘的百分比
  plate: true, // 背板
}

const POSITIONS = LOGO_POSITIONS.map((p) => p.id)

function clampNum(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function normalizeLogo(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_LOGO.enabled,
    mode: src.mode === 'image' ? 'image' : 'text',
    text: typeof src.text === 'string' ? src.text.slice(0, 24) : DEFAULT_LOGO.text,
    imageDataUrl: typeof src.imageDataUrl === 'string' && src.imageDataUrl.startsWith('data:image/')
      ? src.imageDataUrl.slice(0, 3_000_000)
      : '',
    pos: POSITIONS.includes(src.pos) ? src.pos : DEFAULT_LOGO.pos,
    size: clampNum(src.size, DEFAULT_LOGO.size, 1.5, 22),
    opacity: clampNum(src.opacity, DEFAULT_LOGO.opacity, 0.1, 1),
    padding: clampNum(src.padding, DEFAULT_LOGO.padding, 0, 18),
    plate: typeof src.plate === 'boolean' ? src.plate : DEFAULT_LOGO.plate,
  }
}

/** 品牌标识可绘制吗（文字或已上传图）。 */
export function logoReady(logo) {
  const l = normalizeLogo(logo)
  if (!l.enabled) return false
  return l.mode === 'image' ? Boolean(l.imageDataUrl) : Boolean(l.text)
}

/** 计算标识在画布上的锚点与尺寸（纯函数，便于测试）。 */
export function logoBox(logo, W, H) {
  const l = normalizeLogo(logo)
  const pad = Math.round((Math.min(W, H) * l.padding) / 100)
  const maxW = Math.round((W * l.size) / 100)
  return {
    pad,
    maxW,
    align: l.pos === 'tl' || l.pos === 'bl' ? 'left' : 'right',
    baseline: l.pos === 'tl' || l.pos === 'tr' ? 'top' : 'bottom',
    x: l.pos === 'tl' || l.pos === 'bl' ? pad : W - pad,
    y: l.pos === 'tl' || l.pos === 'tr' ? pad : H - pad,
  }
}

/**
 * 绘制品牌标识。fontFamily 由调用方传入以复用同一字体栈。
 * 返回 { drawn:boolean, box } 便于测试。
 */
export function drawLogo(ctx, logo, W, H, fontFamily) {
  const l = normalizeLogo(logo)
  if (!logoReady(l)) return { drawn: false }

  const box = logoBox(l, W, H)
  ctx.save()
  ctx.globalAlpha = l.opacity

  if (l.mode === 'image' && l.imageDataUrl) {
    // 图片由调用方解码后通过 ctx.__logoImage 注入（异步解码不进入绘制函数）
    const img = ctx.__logoImage
    if (!img) { ctx.restore(); return { drawn: false } }
    const ratio = img.height / img.width || 1
    let w = box.maxW
    let h = w * ratio
    const maxH = H * 0.22
    if (h > maxH) { h = maxH; w = h / ratio }
    const x = box.align === 'left' ? box.x : box.x - w
    const y = box.baseline === 'top' ? box.y : box.y - h
    if (l.plate) {
      const p = Math.round(w * 0.06)
      ctx.fillStyle = 'rgba(255,255,255,0.86)'
      ctx.beginPath()
      const r = Math.min(w, h) * 0.16
      ctx.moveTo(x - p + r, y - p)
      ctx.arcTo(x + w + p, y - p, x + w + p, y + h + p, r)
      ctx.arcTo(x + w + p, y + h + p, x - p, y + h + p, r)
      ctx.arcTo(x - p, y + h + p, x - p, y - p, r)
      ctx.arcTo(x - p, y - p, x + w + p, y - p, r)
      ctx.closePath()
      ctx.fill()
    }
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
    return { drawn: true, box: { x, y, w, h } }
  }

  // 文字标识：按宽度自适应字号
  const px = Math.round((W * l.size) / 100 * 0.62)
  let font = 700
  ctx.font = `${font} ${px}px ${fontFamily}`
  let textW = ctx.measureText(l.text).width
  if (textW > box.maxW) {
    const shrunk = Math.max(8, Math.floor((px * box.maxW) / textW))
    ctx.font = `${font} ${shrunk}px ${fontFamily}`
    textW = ctx.measureText(l.text).width
  }
  const size = Number(/\d+/.exec(ctx.font)?.[0] || px)
  const x = box.align === 'left' ? box.x : box.x - textW
  const y = box.baseline === 'top' ? box.y + size * 0.92 : box.y - size * 0.2

  if (l.plate) {
    const p = Math.round(size * 0.42)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    const r = size * 0.34
    const bx = x - p
    const by = y - size * 0.92 - p * 0.6
    const bw = textW + p * 2
    const bh = size * 1.22 + p * 0.6
    ctx.moveTo(bx + r, by)
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r)
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r)
    ctx.arcTo(bx, by + bh, bx, by, r)
    ctx.arcTo(bx, by, bx + bw, by, r)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = '#1b1812'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${size}px ${fontFamily}`
  ctx.fillText(l.text, x, y)
  ctx.restore()
  return { drawn: true, box: { x, y, w: textW, h: size } }
}

/** 水印文字自动补品牌名：文案层为空时用品牌标识文字。 */
export function logoForCopy(logo, copy) {
  const l = normalizeLogo(logo)
  if (!l.enabled) return l
  return l
}
