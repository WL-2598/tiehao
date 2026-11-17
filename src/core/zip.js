import JSZip from 'jszip'
import { toCSV, dedupeName } from './format.js'

const FORMAT_LABEL = {
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/png': 'PNG',
}

const FIT_LABEL = { contain: '留白完整', cover: '铺满裁切' }

/** manifest.csv 行。items: [{name, result, settings}] */
export function buildManifest(items, settings) {
  const rows = [[
    '输出文件', '原文件', '平台', '规格', '画布尺寸', '适配方式', '格式',
    '宽度px', '高度px', '原始大小KB', '输出大小KB', '体积变化', '是否达标', '切片', '备注',
  ]]
  for (const item of items) {
    const r = item.result
    const sliceOf = item.slice && item.slice.total > 1
      ? `${item.slice.index + 1}/${item.slice.total}`
      : ''
    rows.push([
      item.outName,
      item.srcName,
      item.platform || '—',
      item.targetName || (settings.preset === 'original' ? '保持原尺寸' : settings.preset),
      `${r.width}×${r.height}`,
      FIT_LABEL[settings.fit] || settings.fit,
      FORMAT_LABEL[settings.format] || settings.format,
      r.width,
      r.height,
      (item.beforeBytes / 1024).toFixed(1),
      (item.afterBytes / 1024).toFixed(1),
      item.beforeBytes ? `${(((r.afterBytes - item.beforeBytes) / item.beforeBytes) * 100).toFixed(1)}%` : '',
      r.hitTarget ? '达标' : '未达目标',
      sliceOf,
      item.note || '',
    ])
  }
  return toCSV(rows)
}

/**
 * 生成输出包：tiehao-output/按平台分目录 + manifest.csv + README.txt。
 * 按平台建目录，是为了让用户拿到 ZIP 就能直接往各平台里拖，不用自己挑文件。
 */
export async function buildZip(items, settings, meta = {}) {
  const zip = new JSZip()
  const root = zip.folder('tiehao-output')
  const usedByDir = new Map()

  // 一个目标可能产出多张（详情页切片），manifest 每张一行
  const flat = []
  for (const item of items) {
    const dirName = safeDir(item.platform || '')
    const dir = dirName ? root.folder(dirName) : root
    if (!usedByDir.has(dirName)) usedByDir.set(dirName, new Set())
    const used = usedByDir.get(dirName)

    const parts = item.result.slices && item.result.slices.length
      ? item.result.slices
      : [{
        name: item.result.name,
        blob: item.result.blob,
        width: item.result.width,
        height: item.result.height,
      }]

    for (const [i, part] of parts.entries()) {
      const outName = dedupeName(part.name, used)
      dir.file(outName, part.blob)
      flat.push({
        ...item,
        outName: dirName ? `${dirName}/${outName}` : outName,
        result: { ...item.result, width: part.width, height: part.height },
        slice: parts.length > 1 ? { index: i, total: parts.length } : null,
      })
    }
  }

  root.file('manifest.csv', buildManifest(flat, settings))
  root.file('README.txt', readmeText(settings, meta))
  return zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true })
}

/** 平台名 → 安全的目录名（保留中文，去掉文件系统敏感字符）。 */
export function safeDir(name) {
  return String(name || '')
    .replace(/\s*\/\s*/g, '-')          // 「淘宝 / 天猫」→「淘宝-天猫」
    .replace(/[\\:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
}

function readmeText(settings, meta) {
  const lines = [
    '帖好 TieHao 输出包',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `版本：${meta.version || '-'} · ${meta.edition === 'offline' ? '离线批量版' : '在线体验版'}`,
    '',
    '画布与填充',
    `  目标：${meta.targets && meta.targets.length ? meta.targets.join('、') : '自定义画布'}`,
    `  画布：${settings.preset === 'original' ? '保持原尺寸' : `${settings.preset} ${meta.canvas || ''}`}`,
    `  适配：${FIT_LABEL[settings.fit] || settings.fit}`,
    `  底色：${settings.bg}`,
    '',
    '水印',
    `  ${settings.wm?.enabled ? `已添加「${settings.wm.text}」` : '未添加'}`,
    '',
    '压缩',
    `  格式：${FORMAT_LABEL[settings.format] || settings.format}`,
    `  质量：${settings.quality}`,
    `  目标：${settings.targetKB > 0 ? `${settings.targetKB} KB 以内` : '不限制'}`,
    '',
    '说明：画布尺寸为常用工作画布，非平台官方强制规范。图片在浏览器本地处理。',
  ]
  return lines.join('\r\n')
}
