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
    '输出文件', '原文件', '画布尺寸', '适配方式', '格式',
    '宽度px', '高度px', '原始大小KB', '输出大小KB', '体积变化',
  ]]
  for (const item of items) {
    const r = item.result
    rows.push([
      item.outName,
      item.srcName,
      `${r.width}×${r.height}`,
      FIT_LABEL[settings.fit] || settings.fit,
      FORMAT_LABEL[settings.format] || settings.format,
      r.width,
      r.height,
      (item.beforeBytes / 1024).toFixed(1),
      (r.afterBytes / 1024).toFixed(1),
      item.beforeBytes ? `${(((r.afterBytes - item.beforeBytes) / item.beforeBytes) * 100).toFixed(1)}%` : '',
    ])
  }
  return toCSV(rows)
}

/** 生成输出包：tiehao-output/图片 + manifest.csv + README.txt */
export async function buildZip(items, settings, meta = {}) {
  const zip = new JSZip()
  const folder = zip.folder('tiehao-output')
  const used = new Set()
  for (const item of items) {
    const outName = dedupeName(item.result.name, used)
    item.outName = outName
    folder.file(outName, item.result.blob)
  }
  folder.file('manifest.csv', buildManifest(items, settings))
  folder.file('README.txt', readmeText(settings, meta))
  return zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true })
}

function readmeText(settings, meta) {
  const lines = [
    '帖好 TieHao 输出包',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `版本：${meta.version || '-'} · ${meta.edition === 'offline' ? '离线批量版' : '在线体验版'}`,
    '',
    '画布与填充',
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
