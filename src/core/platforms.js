import { clamp } from './format.js'

/**
 * 平台与交付预设。
 * 每个目标 = 一套输出规格；一批图可以一次导出多个目标（一图多版），
 * 这就是「一次上传、全平台铺开」的核心价值。
 *
 * safe：内容安全区（占画布比例），用于「安全区预览」——避免主体被平台 UI 裁掉。
 * note：出现在界面与清单里的取值依据；平台规则会变，写明以便用户自行核对。
 */
export const PLATFORM_PRESETS = [
  {
    id: 'xiaohongshu',
    platform: '小红书',
    name: '图文 3:4',
    w: 1080, h: 1440,
    safe: { top: 0.06, bottom: 0.14, left: 0.05, right: 0.05 },
    note: '竖版图文常用 3:4，底部会叠标题与账号信息',
  },
  {
    id: 'xhs-square',
    platform: '小红书',
    name: '方图 1:1',
    w: 1080, h: 1080,
    safe: { top: 0.06, bottom: 0.1, left: 0.05, right: 0.05 },
    note: '商品与合集常用方图',
  },
  {
    id: 'douyin',
    platform: '抖音',
    name: '竖屏 9:16',
    w: 1080, h: 1920,
    safe: { top: 0.08, bottom: 0.2, left: 0.06, right: 0.16 },
    note: '右侧与底部会压点赞、评论、文案，主体别贴边',
  },
  {
    id: 'shipinhao',
    platform: '视频号',
    name: '竖屏 9:16',
    w: 1080, h: 1920,
    safe: { top: 0.08, bottom: 0.18, left: 0.06, right: 0.06 },
    note: '底部文案区较高',
  },
  {
    id: 'kuaishou',
    platform: '快手',
    name: '竖屏 9:16',
    w: 1080, h: 1920,
    safe: { top: 0.08, bottom: 0.2, left: 0.06, right: 0.14 },
    note: '与抖音相近',
  },
  {
    id: 'bilibili-cover',
    platform: 'B站',
    name: '横版封面 16:9',
    w: 1920, h: 1080,
    safe: { top: 0.05, bottom: 0.18, left: 0.05, right: 0.05 },
    note: '封面右下角会被时长与播放量遮挡',
  },
  {
    id: 'wechat-cover',
    platform: '公众号',
    name: '首图 2.35:1',
    w: 1410, h: 600,
    safe: { top: 0.06, bottom: 0.06, left: 0.04, right: 0.04 },
    note: '转发卡片按 1:1 裁切，主体尽量靠中间',
  },
  {
    id: 'wechat-square',
    platform: '公众号',
    name: '分享卡 1:1',
    w: 1080, h: 1080,
    safe: { top: 0.06, bottom: 0.1, left: 0.05, right: 0.05 },
    note: '聊天里转发时的方图',
  },
  {
    id: 'taobao-main',
    platform: '淘宝 / 天猫',
    name: '主图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 },
    maxKB: 500,
    note: '主图 800×800 起、推荐 1000–1200；单张建议 ≤500KB',
  },
  {
    id: 'taobao-white',
    platform: '淘宝 / 天猫',
    name: '白底图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
    maxKB: 500,
    whiteBg: true,
    note: '第 5 张白底图：纯白底、无文字无 Logo、主体占 60% 以上',
  },
  {
    id: 'taobao-detail',
    platform: '淘宝 / 天猫',
    name: '详情页切片 750',
    w: 750, h: 1500,
    safe: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
    maxKB: 500,
    slice: { width: 750, maxHeight: 1500 },
    note: '详情页宽 750、单张高 ≤1500；超长图会自动竖向切片',
  },
  {
    id: 'jd-main',
    platform: '京东',
    name: '主图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 },
    maxKB: 1024,
    note: '首图纯白底、主体居中；单张 ≤1MB',
  },
  {
    id: 'jd-white',
    platform: '京东',
    name: '白底图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
    maxKB: 1024,
    whiteBg: true,
    note: '首图要求纯白底 RGB(255,255,255)、四边留白约 30px',
  },
  {
    id: 'jd-detail',
    platform: '京东',
    name: '详情页切片 750',
    w: 750, h: 1500,
    safe: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
    maxKB: 500,
    slice: { width: 750, maxHeight: 1500 },
    note: '移动端详情宽 750；单张 ≤500KB，建议单张高 ≤1500',
  },
  {
    id: 'pdd-main',
    platform: '拼多多',
    name: '主图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    maxKB: 1024,
    note: '首图纯白底；角标与促销标签会压到四角',
  },
  {
    id: 'xianyu-main',
    platform: '闲鱼',
    name: '主图 1:1',
    w: 1200, h: 1200,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    maxKB: 2048,
    note: '二手主图建议 800×800 以上方图；最多 9 张，单张 ≤20MB',
  },
  {
    id: 'xianyu-34',
    platform: '闲鱼',
    name: '竖版 3:4',
    w: 1200, h: 1600,
    safe: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 },
    maxKB: 2048,
    note: '闲鱼推荐页里 3:4 观感更好，主图可压一行卖点字',
  },
  {
    id: 'weibo',
    platform: '微博',
    name: '配图 16:9',
    w: 1600, h: 900,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '信息流里按横向展示',
  },
  {
    id: 'zhihu',
    platform: '知乎',
    name: '配图 16:9',
    w: 1600, h: 900,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '正文配图按宽度铺满',
  },
  {
    id: 'instagram-square',
    platform: 'Instagram',
    name: 'Post 1:1',
    w: 1080, h: 1080,
    safe: { top: 0.05, bottom: 0.12, left: 0.05, right: 0.05 },
    note: 'Feed 方图',
  },
  {
    id: 'instagram-45',
    platform: 'Instagram',
    name: 'Post 4:5',
    w: 1080, h: 1350,
    safe: { top: 0.05, bottom: 0.12, left: 0.05, right: 0.05 },
    note: '4:5 在 Feed 占屏最多',
  },
  {
    id: 'tiktok',
    platform: 'TikTok',
    name: 'Vertical 9:16',
    w: 1080, h: 1920,
    safe: { top: 0.08, bottom: 0.2, left: 0.06, right: 0.16 },
    note: '与抖音同规格',
  },
  {
    id: 'youtube-thumb',
    platform: 'YouTube',
    name: 'Thumbnail 16:9',
    w: 1280, h: 720,
    safe: { top: 0.05, bottom: 0.16, left: 0.05, right: 0.05 },
    note: '右下角会压时长',
  },
  {
    id: 'twitter',
    platform: 'X / Twitter',
    name: 'Post 16:9',
    w: 1600, h: 900,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '时间线按横向展示',
  },
  {
    id: 'linkedin',
    platform: 'LinkedIn',
    name: 'Post 1.91:1',
    w: 1200, h: 628,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '信息流横图',
  },
  {
    id: 'facebook',
    platform: 'Facebook',
    name: 'Post 1.91:1',
    w: 1200, h: 628,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '信息流横图',
  },
  {
    id: 'pinterest',
    platform: 'Pinterest',
    name: 'Pin 2:3',
    w: 1000, h: 1500,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '竖长图，瀑布流展示',
  },
  {
    id: 'print-a4',
    platform: '打印 / 交付',
    name: 'A4 300dpi',
    w: 2480, h: 3508,
    safe: { top: 0.03, bottom: 0.03, left: 0.03, right: 0.03 },
    note: '约 210×297mm，可用于打印打样',
  },
  {
    id: 'print-a5',
    platform: '打印 / 交付',
    name: 'A5 300dpi',
    w: 1748, h: 2480,
    safe: { top: 0.03, bottom: 0.03, left: 0.03, right: 0.03 },
    note: '约 148×210mm',
  },
  {
    id: 'web-hero',
    platform: '网站 / 交付',
    name: 'Hero 21:9',
    w: 2100, h: 900,
    safe: { top: 0.06, bottom: 0.06, left: 0.06, right: 0.06 },
    note: '首页通栏横幅',
  },
  {
    id: 'web-banner',
    platform: '网站 / 交付',
    name: 'Banner 3:1',
    w: 1500, h: 500,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
    note: '移动端会被裁成方形，主体居中',
  },
]

export const PLATFORM_GROUPS = [...new Set(PLATFORM_PRESETS.map((p) => p.platform))]

export function findPreset(id) {
  return PLATFORM_PRESETS.find((p) => p.id === id) || null
}

/** 一批目标 → 去重后的目标列表（同尺寸同平台只保留一个）。 */
export function normalizeTargets(ids) {
  const seen = new Set()
  const out = []
  for (const id of Array.isArray(ids) ? ids : []) {
    const preset = findPreset(id)
    if (!preset || seen.has(id)) continue
    seen.add(id)
    out.push(preset)
  }
  return out
}

/**
 * 从一组目标里推导安全区并集：多个平台同时投放时，
 * 取最严格的边框，保证同一张构图在哪儿都不被裁。
 */
export function unionSafeArea(presets) {
  const list = presets.length ? presets : PLATFORM_PRESETS.filter((p) => p.id === 'xiaohongshu')
  return {
    top: Math.max(...list.map((p) => p.safe.top)),
    bottom: Math.max(...list.map((p) => p.safe.bottom)),
    left: Math.max(...list.map((p) => p.safe.left)),
    right: Math.max(...list.map((p) => p.safe.right)),
  }
}

/**
 * 目标规格带来的隐含约束：白底图不能有文案/水印/Logo，
 * 有体积上限的目标要据此收敛压缩目标。
 * 返回 { maxKB, whiteBg, noText, slice }
 */
export function targetConstraints(preset) {
  if (!preset) return { maxKB: 0, whiteBg: false, noText: false, slice: null }
  return {
    maxKB: Number(preset.maxKB) || 0,
    whiteBg: Boolean(preset.whiteBg),
    noText: Boolean(preset.whiteBg),   // 白底图的硬规则：不许任何文字/水印/Logo
    slice: preset.slice || null,
  }
}

/** 目标要求「无文字」时，哪些设置项会被强制关掉（用于 UI 提示）。 */
export const NO_TEXT_FEATURES = ['copy', 'wm', 'logo']

/** 需要按平台切片的目标判断。 */
export function wantsSlice(preset) {
  return Boolean(preset?.slice)
}

/** 安全区矩形（像素），供预览叠加与提示使用。 */
export function safeRect(preset) {
  const s = preset?.safe || { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 }
  return {
    x: Math.round(preset.w * s.left),
    y: Math.round(preset.h * s.top),
    w: Math.round(preset.w * (1 - s.left - s.right)),
    h: Math.round(preset.h * (1 - s.top - s.bottom)),
  }
}

/** 极简 SVG 平台标记（不引入外部图标，保证离线可用）。 */
export function platformGlyph(id) {
  const g = {
    xiaohongshu: '<rect x="3" y="4" width="18" height="16" rx="5"/><path d="M8 9.5v5M12 8v8M16 9.5v5"/>',
    douyin: '<path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.6 2.2 2 3.4 4.2 3.6"/>',
    shipinhao: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9.5 15 12l-5 2.5Z"/>',
    kuaishou: '<path d="M5 8.5 12 5l7 3.5v7L12 19l-7-3.5Z"/><path d="M9.5 12h5"/>',
    'bilibili-cover': '<rect x="3.5" y="7" width="17" height="12" rx="3"/><path d="m7 3.5 2.5 3M17 3.5 14.5 6.5"/><path d="M9.5 11v3M14.5 11v3"/>',
    'wechat-cover': '<path d="M4 6h16v12H4Z"/><circle cx="9" cy="11" r="2"/><path d="m5 17 4.5-4 3 3 2.5-2 3.5 3"/>',
    'wechat-square': '<path d="M4 6h16v12H4Z"/><circle cx="9" cy="11" r="2"/><path d="m5 17 4.5-4 3 3 2.5-2 3.5 3"/>',
    'taobao-main': '<path d="M6 9h12l-1 10H7Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    'taobao-white': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h6M9 15h4"/>',
    'taobao-detail': '<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9.5 8h5M9.5 12h5M9.5 16h3"/>',
    'jd-white': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h6"/>',
    'jd-detail': '<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9.5 8h5M9.5 12h5"/>',
    'xianyu-main': '<path d="M4 9.5 12 5l8 4.5-8 4.5Z"/><path d="M4 14 12 18.5 20 14"/>',
    'xianyu-34': '<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="m9 15 3-3 3 3"/><path d="M12 12V7"/>',
    'jd-main': '<path d="M5 9h14l-1.2 10H6.2Z"/><path d="M9 9V7.5a3 3 0 0 1 6 0V9"/>',
    'pdd-main': '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M8 7V5.5M16 7V5.5"/><path d="M9 13h6"/>',
    weibo: '<circle cx="12" cy="13" r="6"/><path d="M7 7c2-2 6-2.5 9-1"/><path d="M15.5 4.5c2 .5 3.5 2 4 4"/>',
    zhihu: '<path d="M5 5h6l-3 9H5Zm0 9h3l3 5"/>',
    'instagram-square': '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="16.6" cy="7.4" r="1"/>',
    'instagram-45': '<rect x="5" y="3.5" width="14" height="17" rx="4"/><circle cx="12" cy="12" r="4"/>',
    tiktok: '<path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.6 2.2 2 3.4 4.2 3.6"/>',
    'youtube-thumb': '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="m10.5 9.5 5 2.5-5 2.5Z"/>',
    twitter: '<path d="M4 5h4l4 5 4-5h4l-6 7.5L20 19h-4l-4-5-4 5H4l6-7.5Z"/>',
    linkedin: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10v6M8 8v.01M12 16v-3.5a2 2 0 0 1 4 0V16"/>',
    facebook: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M13.5 20v-6h2.2l.3-2.6h-2.5V9.8c0-.7.3-1.2 1.2-1.2h1.4V6.3c-.6-.1-1.4-.2-2.2-.2-2 0-3.4 1.2-3.4 3.4v1.9H8.3V14h2.2v6Z"/>',
    pinterest: '<circle cx="12" cy="12" r="8.5"/><path d="M10 19c.8-1.2 1.2-2.6 1.5-4l.8-3.2"/><path d="M9.6 11.6c-.6-2 .8-3.9 2.9-3.9 1.7 0 2.7 1 2.7 2.6 0 1.8-1 3.3-2.4 3.3-.7 0-1.2-.5-1-1.3"/>',
    'print-a4': '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 15.5h6"/>',
    'print-a5': '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 15.5h4"/>',
    'web-hero': '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M6 13.5h6"/>',
    'web-banner': '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 12h5"/>',
  }
  return g[id] || g['web-hero']
}

/** 长文件名的安全化（避免不可见字符与路径符号）。 */
export function safeSlug(text, max = 28) {
  return String(text || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'untitled'
}

/** 输出文件名模板。占位符：{name} {platform} {w} {h} {index} {ext} */
export const FILENAME_TOKENS = ['{name}', '{platform}', '{w}', '{h}', '{index}', '{ext}']

export function buildOutputName(template, ctx) {
  const body = String(template || '{name}')
    .replace(/\{name\}/g, ctx.name || 'untitled')
    .replace(/\{platform\}/g, ctx.platform || '')
    .replace(/\{w\}/g, String(ctx.w ?? ''))
    .replace(/\{h\}/g, String(ctx.h ?? ''))
    .replace(/\{index\}/g, String(ctx.index ?? 1).padStart(2, '0'))
  const slugged = safeSlug(body, 90)
  return `${slugged}.${ctx.ext}`
}

/** 用目标尺寸计算一批图的最大/最小体积差异提示。 */
export function targetSummary(presets) {
  if (!presets.length) return '未选择目标'
  if (presets.length === 1) return `${presets[0].platform} ${presets[0].name}`
  const platforms = [...new Set(presets.map((p) => p.platform))]
  return `${presets.length} 个目标 · ${platforms.length} 个平台`
}

export function clampTargetCount(n, max = 8) {
  return clamp(Math.round(n) || 0, 0, max)
}

/**
 * 「上架包」：把真实卖家一次上架要准备的那套图打包好，一键勾选。
 * 淘宝/京东的主图 + 白底图 + 详情页切片就是一次完整的上架素材。
 */
export const TARGET_PACKS = [
  {
    id: 'taobao-listing',
    label: '淘宝上架包',
    hint: '主图 + 白底图 + 详情页切片（符合 750 宽、单张 ≤1500 高的规范）',
    targets: ['taobao-main', 'taobao-white', 'taobao-detail'],
  },
  {
    id: 'jd-listing',
    label: '京东上架包',
    hint: '首图 + 白底图 + 详情页切片（主图 ≤1MB、详情图 ≤500KB）',
    targets: ['jd-main', 'jd-white', 'jd-detail'],
  },
  {
    id: 'xianyu-listing',
    label: '闲鱼发布包',
    hint: '方图主图 + 3:4 竖版，二手商品两种比例都备好',
    targets: ['xianyu-main', 'xianyu-34'],
  },
  {
    id: 'social-all',
    label: '社媒全家桶',
    hint: '小红书、抖音、视频号各一套竖版',
    targets: ['xiaohongshu', 'douyin', 'shipinhao'],
  },
]

export function findPack(id) {
  return TARGET_PACKS.find((p) => p.id === id) || null
}

/** 上架包当前是否已全部选中。 */
export function packSelected(pack, activeIds) {
  return pack.targets.every((t) => activeIds.includes(t))
}
