import { clamp } from './format.js'
import { normalizeCopy, DEFAULT_COPY } from './typography.js'
import { normalizeLogo, DEFAULT_LOGO } from './logo.js'
import { normalizeTargets, PLATFORM_PRESETS } from './platforms.js'

/** 画布预设。w/h 为 null 表示跟随原图或取自定义值。 */
export const CANVAS_PRESETS = [
  { id: 'portrait34', label: '竖版图文 3:4', sub: '1080 × 1440', w: 1080, h: 1440 },
  { id: 'square11', label: '方形商品 1:1', sub: '1200 × 1200', w: 1200, h: 1200 },
  { id: 'landscape169', label: '横版封面 16:9', sub: '1920 × 1080', w: 1920, h: 1080 },
  { id: 'vertical916', label: '竖版视频 9:16', sub: '1080 × 1920', w: 1080, h: 1920 },
  { id: 'original', label: '保持原尺寸', sub: '按原图像素', w: null, h: null },
  { id: 'custom', label: '自定义尺寸', sub: '自定宽 × 高', w: null, h: null },
]

export const OUTPUT_FORMATS = [
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg', hint: '体积小，兼容最好，不支持透明' },
  { id: 'image/webp', label: 'WebP', ext: 'webp', hint: '体积最小，主流平台与浏览器均支持' },
  { id: 'image/png', label: 'PNG', ext: 'png', hint: '无损、支持透明，体积通常较大' },
]

export const WM_POSITIONS = [
  { id: 'tl', label: '左上' },
  { id: 'tr', label: '右上' },
  { id: 'bl', label: '左下' },
  { id: 'br', label: '右下' },
  { id: 'center', label: '居中' },
]

export const WM_FONTS = [
  { id: 'sans', label: '黑体', stack: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif' },
  { id: 'serif', label: '宋体', stack: '"Songti SC","STSong","Noto Serif SC","SimSun",serif' },
  { id: 'light', label: '细黑', stack: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif', weight: 300 },
]

export const DEFAULT_SETTINGS = {
  preset: 'portrait34',
  customW: 1080,
  customH: 1440,
  fit: 'contain',
  bg: '#f6f1e8',
  format: 'image/jpeg',
  quality: 0.85,
  targetKB: 500,
  // 一图多版：勾选的平台目标（空 = 用上面的「画布+适配」单目标）
  targets: [],
  // 裁切焦点（cover 时生效，0-1，默认居中）
  focus: { x: 0.5, y: 0.5 },
  // 白边裁剪
  trim: { enabled: false, bg: '#ffffff', tolerance: 14, pad: 0.02 },
  // 文案层（标题 / 卖点 / 价签）
  copy: { ...DEFAULT_COPY },
  // 品牌标识（文字或上传 PNG）
  logo: { ...DEFAULT_LOGO, enabled: false },
  // 文件名模板，占位符 {name} {platform} {w} {h} {index} {ext}
  nameTemplate: '{name}-{platform}-{w}x{h}',
  wm: {
    enabled: true,
    text: '@你的品牌',
    pos: 'br',
    color: '#ffffff',
    size: 4,
    opacity: 0.75,
    font: 'sans',
    bold: true,
    stroke: true,
    tiled: false,
  },
}

function num(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

function str(v, fallback, max = 200) {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : fallback
}

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback
}

function oneOf(v, list, fallback) {
  return list.includes(v) ? v : fallback
}

/** 把任意来源（预设导入 / 本地存档）整理成合法设置。 */
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const wm = src.wm && typeof src.wm === 'object' ? src.wm : {}
  const fontIds = WM_FONTS.map((f) => f.id)
  return {
    preset: oneOf(src.preset, CANVAS_PRESETS.map((p) => p.id), DEFAULT_SETTINGS.preset),
    customW: Math.round(num(src.customW, DEFAULT_SETTINGS.customW, 16, 8000)),
    customH: Math.round(num(src.customH, DEFAULT_SETTINGS.customH, 16, 8000)),
    fit: oneOf(src.fit, ['contain', 'cover'], DEFAULT_SETTINGS.fit),
    bg: /^#[0-9a-fA-F]{6}$/.test(src.bg || '') ? src.bg : DEFAULT_SETTINGS.bg,
    format: oneOf(src.format, OUTPUT_FORMATS.map((f) => f.id), DEFAULT_SETTINGS.format),
    quality: num(src.quality, DEFAULT_SETTINGS.quality, 0.3, 1),
    targetKB: Math.round(num(src.targetKB, DEFAULT_SETTINGS.targetKB, 0, 20000)),
    targets: normalizeTargets(src.targets).map((p) => p.id),
    focus: {
      x: num(src.focus?.x, 0.5, 0, 1),
      y: num(src.focus?.y, 0.5, 0, 1),
    },
    trim: {
      enabled: bool(src.trim?.enabled, false),
      bg: /^#[0-9a-fA-F]{6}$/.test(src.trim?.bg || '') ? src.trim.bg : '#ffffff',
      tolerance: Math.round(num(src.trim?.tolerance, 14, 0, 80)),
      pad: num(src.trim?.pad, 0.02, 0, 0.2),
    },
    copy: normalizeCopy(src.copy),
    logo: normalizeLogo(src.logo),
    // 允许用户清空模板（表示用原文件名），所以这里不用 str() 的「空则回落」逻辑
    nameTemplate: typeof src.nameTemplate === 'string' ? src.nameTemplate.slice(0, 60) : DEFAULT_SETTINGS.nameTemplate,
    wm: {
      enabled: bool(wm.enabled, DEFAULT_SETTINGS.wm.enabled),
      text: str(wm.text, DEFAULT_SETTINGS.wm.text, 40),
      pos: oneOf(wm.pos, WM_POSITIONS.map((p) => p.id), DEFAULT_SETTINGS.wm.pos),
      color: /^#[0-9a-fA-F]{6}$/.test(wm.color || '') ? wm.color : DEFAULT_SETTINGS.wm.color,
      size: num(wm.size, DEFAULT_SETTINGS.wm.size, 1, 20),
      opacity: num(wm.opacity, DEFAULT_SETTINGS.wm.opacity, 0.05, 1),
      font: oneOf(wm.font, fontIds, DEFAULT_SETTINGS.wm.font),
      bold: bool(wm.bold, DEFAULT_SETTINGS.wm.bold),
      stroke: bool(wm.stroke, DEFAULT_SETTINGS.wm.stroke),
      tiled: bool(wm.tiled, DEFAULT_SETTINGS.wm.tiled),
    },
  }
}
