import { clamp } from './format.js'

/**
 * 一体式排版引擎：把「原图 + 文案层」排成一张可以直接发出去的图。
 * 这不是裁图——它生成标题、卖点、角标、价签、页脚，
 * 排版逻辑全部在本地，不依赖任何在线设计工具。
 */

export const LAYOUTS = [
  { id: 'poster-bottom', label: '海报 · 文案压底', hint: '图在上、文案在下，最稳的带货排版' },
  { id: 'poster-top', label: '海报 · 文案压顶', hint: '标题先出场，适合资讯与清单' },
  { id: 'center-card', label: '居中卡片', hint: '半透明卡片居中，商品图四周留白' },
  { id: 'side-panel', label: '左侧信息栏', hint: '横图专用，文字贴在左三分之一' },
  { id: 'ticket', label: '价签卡片', hint: '大字价格 + 卖点，促销活动常用' },
  { id: 'minimal', label: '极简角标', hint: '只加角落标签，几乎不改原图' },
]

export const TONES = [
  { id: 'ink', label: '墨黑', bg: '#1b1812', fg: '#fffdf8', accent: '#e06a4e' },
  { id: 'paper', label: '纸白', bg: '#f6f2ea', fg: '#1b1812', accent: '#c8402a' },
  { id: 'vermilion', label: '朱砂', bg: '#c8402a', fg: '#fff6ef', accent: '#f7d9a8' },
  { id: 'pine', label: '松绿', bg: '#2f5d50', fg: '#f2f7f2', accent: '#d9c07a' },
  { id: 'night', label: '夜蓝', bg: '#1f2340', fg: '#f2f0ff', accent: '#f0c46a' },
  { id: 'custom', label: '自定义', bg: '#111111', fg: '#ffffff', accent: '#ffb400' },
]

export const DEFAULT_COPY = {
  layout: 'poster-bottom',
  tone: 'ink',
  customBg: '#1b1812',
  customFg: '#fffdf8',
  customAccent: '#e06a4e',
  // 默认必须为空：文案层在用户输入之前不参与合成，避免默认改动用户的图
  title: '',
  subtitle: '',
  points: '',
  badge: '',
  price: '',
  priceNote: '',
  footer: '',
  align: 'left',
  scale: 1,
  scrim: 0.55,
}

const ALIGNS = ['left', 'center', 'right']

function str(v, fallback, max = 120) {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : fallback
}

function num(v, fallback, min, max) {
  const n = Number(v)
  return Number.isFinite(n) ? clamp(n, min, max) : fallback
}

function hex(v, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : fallback
}

export function normalizeCopy(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    layout: LAYOUTS.some((l) => l.id === src.layout) ? src.layout : DEFAULT_COPY.layout,
    tone: TONES.some((t) => t.id === src.tone) ? src.tone : DEFAULT_COPY.tone,
    customBg: hex(src.customBg, DEFAULT_COPY.customBg),
    customFg: hex(src.customFg, DEFAULT_COPY.customFg),
    customAccent: hex(src.customAccent, DEFAULT_COPY.customAccent),
    title: typeof src.title === 'string' ? src.title.slice(0, 60) : DEFAULT_COPY.title,
    subtitle: typeof src.subtitle === 'string' ? src.subtitle.slice(0, 80) : DEFAULT_COPY.subtitle,
    points: typeof src.points === 'string' ? src.points.slice(0, 160) : DEFAULT_COPY.points,
    badge: typeof src.badge === 'string' ? src.badge.slice(0, 12) : DEFAULT_COPY.badge,
    price: typeof src.price === 'string' ? src.price.slice(0, 16) : DEFAULT_COPY.price,
    priceNote: typeof src.priceNote === 'string' ? src.priceNote.slice(0, 24) : DEFAULT_COPY.priceNote,
    footer: typeof src.footer === 'string' ? src.footer.slice(0, 40) : DEFAULT_COPY.footer,
    align: ALIGNS.includes(src.align) ? src.align : DEFAULT_COPY.align,
    scale: num(src.scale, DEFAULT_COPY.scale, 0.6, 1.6),
    scrim: num(src.scrim, DEFAULT_COPY.scrim, 0, 0.92),
  }
}

export function toneColors(copy) {
  const tone = TONES.find((t) => t.id === copy.tone) || TONES[0]
  if (tone.id === 'custom') {
    return { bg: copy.customBg, fg: copy.customFg, accent: copy.customAccent, id: 'custom' }
  }
  return { bg: tone.bg, fg: tone.fg, accent: tone.accent, id: tone.id }
}

/** 卖点字符串 → 数组（支持中英文逗号、换行、顿号分隔）。 */
export function parsePoints(raw) {
  return String(raw || '')
    .split(/[,，\n、;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
}

/* ------------------------------------------------------------ 文本排版 */

/** 按宽度折行（中文按字，英文按词），返回行数组。 */
export function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const src = String(text || '').trim()
  if (!src) return []
  const lines = []
  let line = ''
  const tokens = src.match(/[A-Za-z0-9@#%+\-.]+|\s+|[^\s]/g) || []
  for (const token of tokens) {
    const next = line + token
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line.trimEnd())
      line = token.trimStart()
      if (lines.length === maxLines - 1) {
        // 最后一行：剩余内容截断并加省略号
        let rest = line + tokens.slice(tokens.indexOf(token) + 1).join('')
        rest = rest.trim()
        while (rest && ctx.measureText(rest + '…').width > maxWidth) rest = rest.slice(0, -1)
        lines.push(rest ? rest + '…' : line)
        return lines
      }
    }
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines.slice(0, maxLines)
}

/** 圆角矩形（兼容不支持 roundRect 的旧浏览器）。 */
export function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fontSpec(weight, px, family) {
  return `${weight} ${Math.round(px)}px ${family}`
}

const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif'
const SERIF = '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",Georgia,serif'

function withAlpha(hexColor, alpha) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hexColor || '')
  if (!m) return `rgba(0,0,0,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/**
 * 绘制文案层。imageRect 是原图在画布上的区域，
 * 排版会避开这块区域（或在上面叠渐变遮罩），保证文字可读。
 * 返回 { blocks } 便于测试断言文字真的被画了。
 */
export function drawCopyLayer(ctx, copy, W, H, imageRect = null) {
  const c = normalizeCopy(copy)
  const colors = toneColors(c)
  const align = c.align
  const alignX = align === 'center' ? W / 2 : align === 'right' ? W * 0.92 : W * 0.08
  const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
  const pad = Math.round(Math.min(W, H) * 0.075)
  const blocks = []

  ctx.save()
  ctx.textAlign = textAlign
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = colors.fg

  const drawWrapped = (text, { px, weight, family, maxWidth, x, y, lineHeight = 1.28, maxLines = 3, color }) => {
    ctx.font = fontSpec(weight, px, family)
    ctx.fillStyle = color || colors.fg
    const lines = wrapText(ctx, text, maxWidth, maxLines)
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * px * lineHeight))
    const height = lines.length * px * lineHeight
    if (lines.length) blocks.push({ text: lines.join(''), x, y, height })
    return y + height
  }

  /* ---------------------------------------------------------- 极简角标 */
  if (c.layout === 'minimal') {
    if (c.badge) {
      const px = Math.round(Math.min(W, H) * 0.035 * c.scale)
      ctx.font = fontSpec(700, px, SANS)
      const textW = ctx.measureText(c.badge).width
      const bw = textW + px * 1.6
      const bh = px * 2.3
      const bx = pad * 0.7
      const by = pad * 0.7
      ctx.fillStyle = colors.accent
      roundedRect(ctx, bx, by, bw, bh, bh / 2)
      ctx.fill()
      ctx.fillStyle = '#1b1812'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = fontSpec(700, px, SANS)
      ctx.fillText(c.badge, bx + bw / 2, by + bh / 2 + px * 0.04)
      blocks.push({ text: c.badge, x: bx, y: by, height: bh })
    }
    if (c.footer) {
      const px = Math.round(Math.min(W, H) * 0.028 * c.scale)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.font = fontSpec(600, px, SANS)
      ctx.fillStyle = colors.fg
      ctx.globalAlpha = 0.9
      ctx.fillText(c.footer, W - pad * 0.6, H - pad * 0.5)
      ctx.globalAlpha = 1
      blocks.push({ text: c.footer, x: W - pad * 0.6, y: H - pad * 0.5, height: px })
    }
    ctx.restore()
    return { blocks, colors }
  }

  /* ------------------------------------------------- 面板型排版（前三类） */
  const hasPoints = parsePoints(c.points).length > 0
  const panelRatio =
    c.layout === 'ticket' ? 0.46
      : c.layout === 'center-card' ? 0.5
        : c.layout === 'side-panel' ? 0.62
          : hasPoints ? 0.42 : 0.32
  const isBottom = c.layout === 'poster-bottom' || c.layout === 'ticket'
  const isTop = c.layout === 'poster-top'
  const panelH = Math.round(H * panelRatio)
  const panelY = isTop ? 0 : isBottom ? H - panelH : Math.round((H - panelH) / 2)

  if (isBottom || isTop) {
    // 原图铺满，文案区叠渐变遮罩，边界自然过渡
    const g = ctx.createLinearGradient(0, isBottom ? panelY - H * 0.12 : panelY + panelH + H * 0.12, 0, isBottom ? H : panelY)
    g.addColorStop(0, withAlpha(colors.bg, 0))
    g.addColorStop(0.45, withAlpha(colors.bg, c.scrim))
    g.addColorStop(1, withAlpha(colors.bg, Math.min(1, c.scrim + 0.28)))
    ctx.fillStyle = g
    ctx.fillRect(0, isBottom ? panelY - H * 0.12 : panelY, W, panelH + H * 0.12)
  } else {
    // 居中卡片 / 左侧信息栏：实底面板
    ctx.fillStyle = withAlpha(colors.bg, Math.min(1, c.scrim + 0.35))
    if (c.layout === 'side-panel') {
      ctx.fillRect(0, 0, Math.round(W * 0.42), H)
    } else {
      roundedRect(ctx, W * 0.06, panelY, W * 0.88, panelH, Math.min(W, H) * 0.045)
      ctx.fill()
    }
  }

  /* ------------------------------------------------------------- 内容 */
  const innerPad = c.layout === 'side-panel' ? Math.round(W * 0.045) : pad
  const x = c.layout === 'side-panel' ? innerPad : alignX
  const maxWidth = c.layout === 'side-panel' ? Math.round(W * 0.42 - innerPad * 2) : W - pad * 2
  let y = panelY + panelH * 0.24

  // 角标
  if (c.badge) {
    const px = Math.round(Math.min(W, H) * 0.024 * c.scale)
    ctx.font = fontSpec(700, px, SANS)
    const bw = ctx.measureText(c.badge).width + px * 1.8
    const bh = px * 2.2
    const bx = textAlign === 'center' ? x - bw / 2 : textAlign === 'right' ? x - bw : x
    ctx.fillStyle = colors.accent
    roundedRect(ctx, bx, y - bh * 0.72, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = '#1b1812'
    const savedAlign = ctx.textAlign
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(c.badge, bx + bw / 2, y - bh * 0.72 + bh / 2 + px * 0.04)
    ctx.textAlign = savedAlign
    ctx.textBaseline = 'alphabetic'
    blocks.push({ text: c.badge, x: bx, y: y - bh, height: bh })
    y += px * 0.6
  }

  // 标题
  const titlePx = Math.round(Math.min(W, H) * (c.layout === 'ticket' ? 0.085 : 0.072) * c.scale)
  y = drawWrapped(c.title, {
    px: titlePx, weight: 800, family: SERIF, maxWidth, x, y,
    lineHeight: 1.22, maxLines: 3,
  })

  // 副标题
  if (c.subtitle) {
    y += titlePx * 0.18
    const subPx = Math.round(Math.min(W, H) * 0.03 * c.scale)
    y = drawWrapped(c.subtitle, {
      px: subPx, weight: 500, family: SANS, maxWidth, x, y,
      lineHeight: 1.35, maxLines: 2, color: withAlpha(colors.fg, 0.82),
    })
  }

  // 卖点：一行或双列，前面加小圆点
  const points = parsePoints(c.points)
  if (points.length) {
    const pPx = Math.round(Math.min(W, H) * 0.027 * c.scale)
    ctx.font = fontSpec(600, pPx, SANS)
    ctx.fillStyle = colors.accent
    const itemH = pPx * 2
    let px2 = x
    let py = y + pPx * 1.1
    for (const point of points) {
      const label = `· ${point}`
      const w = ctx.measureText(label).width + pPx * 0.8
      if (px2 + w > x + maxWidth + 2 && px2 !== x) {
        px2 = x
        py += itemH * 0.78
      }
      ctx.fillStyle = colors.accent
      ctx.fillText(label, px2, py)
      blocks.push({ text: point, x: px2, y: py, height: pPx })
      px2 += w
    }
    y = py + pPx * 1.2
  }

  // 价格
  if (c.price) {
    const pPx = Math.round(Math.min(W, H) * 0.11 * c.scale)
    ctx.font = fontSpec(900, pPx, SANS)
    ctx.fillStyle = colors.accent
    const priceY = Math.min(panelY + panelH - innerPad * 0.6, y + pPx * 0.95)
    ctx.fillText(c.price, x, priceY)
    blocks.push({ text: c.price, x, y: priceY, height: pPx })
    if (c.priceNote) {
      const notePx = Math.round(Math.min(W, H) * 0.024 * c.scale)
      ctx.font = fontSpec(500, notePx, SANS)
      ctx.fillStyle = withAlpha(colors.fg, 0.72)
      const priceW = ctx.measureText(c.price).width
      ctx.fillText(c.priceNote, textAlign === 'right' ? x : x + priceW + notePx * 0.5, priceY - pPx * 0.12)
    }
    y = priceY + pPx * 0.4
  }

  // 页脚
  if (c.footer) {
    const fPx = Math.round(Math.min(W, H) * 0.024 * c.scale)
    ctx.font = fontSpec(600, fPx, SANS)
    ctx.fillStyle = withAlpha(colors.fg, 0.75)
    const fy = Math.min(H - innerPad * 0.55, Math.max(y + fPx, panelY + panelH - innerPad * 0.42))
    ctx.fillText(c.footer, x, fy)
    blocks.push({ text: c.footer, x, y: fy, height: fPx })
  }

  ctx.restore()
  return { blocks, colors }
}

/** 是否启用文案层：标题或价格有内容即视为启用。 */
export function copyIsActive(copy) {
  if (!copy) return false
  const c = normalizeCopy(copy)
  return Boolean(c.title || c.price || c.badge || c.subtitle)
}
