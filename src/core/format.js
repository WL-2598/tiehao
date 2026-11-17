/** 通用纯函数：格式化、命名、CSV、下载。 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

let uidCounter = 0
export function uid(prefix = 'id') {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

export function formatKB(n) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const kb = n / 1024
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`
}

/** 压缩率：正数表示变小（节省），负数表示变大 */
export function formatDelta(before, after) {
  if (!before || !after) return '—'
  const pct = (1 - after / before) * 100
  if (Math.abs(pct) < 0.05) return '持平'
  return pct > 0 ? `省 ${pct.toFixed(0)}%` : `增 ${Math.abs(pct).toFixed(0)}%`
}

export function debounce(fn, ms = 200) {
  let t = 0
  let lastArgs = null
  return function debounced(...args) {
    lastArgs = args
    clearTimeout(t)
    t = setTimeout(() => {
      t = 0
      fn.apply(this, lastArgs)
    }, ms)
  }
}

export function baseName(filename) {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

export function extForMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function isAcceptedImage(file) {
  if (!file) return false
  if (ACCEPTED_TYPES.includes(file.type)) return true
  return /\.(jpe?g|png|webp)$/i.test(file.name || '')
}

export function csvCell(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows) {
  // BOM 让 Excel 正确识别 UTF-8 中文
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** 在已用名字集合里生成不重复的文件名：a.jpg -> a_2.jpg */
export function dedupeName(name, used) {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const i = name.lastIndexOf('.')
  const stem = i > 0 ? name.slice(0, i) : name
  const ext = i > 0 ? name.slice(i) : ''
  let n = 2
  while (used.has(`${stem}_${n}${ext}`)) n += 1
  const out = `${stem}_${n}${ext}`
  used.add(out)
  return out
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(text, filename, mime = 'text/plain') {
  download(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}
