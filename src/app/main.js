import { config } from '../config.js'
import {
  normalizeSettings,
  DEFAULT_SETTINGS,
  CANVAS_PRESETS,
  OUTPUT_FORMATS,
  WM_POSITIONS,
} from '../core/settings.js'
import { createPresetStore } from '../core/store.js'
import { processFile, composePreview, canvasToURL, decodeImage } from '../core/pipeline.js'
import { buildZip, buildManifest } from '../core/zip.js'
import { makeSampleFiles, makeSampleSource } from '../core/samples.js'
import * as F from '../core/format.js'
import { icon } from './icons.js'
import { toast, initModal, initReveal, initCountUp, initNavScroll } from './ui.js'

const CONFIG = { ...config, ...(window.__TIEHAO_CONFIG__ || {}) }
const EDITION = CONFIG.edition === 'offline' ? 'offline' : 'web'
const MAX_FILES = EDITION === 'offline' ? CONFIG.offlineMaxFiles : CONFIG.webMaxFiles
const SETTINGS_KEY = 'tiehao.settings.v1'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const store = createPresetStore()

const state = {
  settings: loadSettings(),
  items: [],
  selectedId: null,
  previewMode: 'after',
  busy: false,
  previewToken: '',
}

/* ---------------------------------------------------------------- settings */

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return normalizeSettings(JSON.parse(raw))
  } catch { /* 忽略损坏的存档 */ }
  return normalizeSettings({})
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
  } catch { /* 隐私模式等场景下静默失败 */ }
}

function readSettingsFromDOM() {
  return normalizeSettings({
    preset: $('#preset').value,
    customW: $('#customW').value,
    customH: $('#customH').value,
    fit: document.querySelector('[data-fit].active')?.dataset.fit || 'contain',
    bg: $('#bgColor').value,
    format: $('#format').value,
    quality: $('#quality').value,
    targetKB: $('#targetKB').value,
    wm: {
      enabled: $('#wmEnable').checked,
      text: $('#wmText').value,
      pos: document.querySelector('[data-pos].active')?.dataset.pos || 'br',
      color: $('#wmColor').value,
      size: $('#wmSize').value,
      opacity: $('#wmOpacity').value,
      font: $('#wmFont').value,
      bold: $('#wmBold').checked,
      stroke: $('#wmStroke').checked,
      tiled: $('#wmTiled').checked,
    },
  })
}

function applySettingsToDOM(settings) {
  $('#preset').value = settings.preset
  $('#customW').value = settings.customW
  $('#customH').value = settings.customH
  $$('[data-fit]').forEach((b) => b.classList.toggle('active', b.dataset.fit === settings.fit))
  $('#bgColor').value = settings.bg
  $('#format').value = settings.format
  $('#quality').value = settings.quality
  $('#targetKB').value = settings.targetKB
  $('#wmEnable').checked = settings.wm.enabled
  $('#wmText').value = settings.wm.text
  $('#wmFont').value = settings.wm.font
  $('#wmBold').checked = settings.wm.bold
  $('#wmStroke').checked = settings.wm.stroke
  $('#wmTiled').checked = settings.wm.tiled
  $('#wmColor').value = settings.wm.color
  $('#wmSize').value = settings.wm.size
  $('#wmOpacity').value = settings.wm.opacity
  $$('[data-pos]').forEach((b) => b.classList.toggle('active', b.dataset.pos === settings.wm.pos))
  syncSettingOutputs()
  refreshControlStates()
}

function syncSettingOutputs() {
  const q = Number($('#quality').value)
  $('#qualityOut').textContent = q.toFixed(2)
  const s = Number($('#wmSize').value)
  $('#wmSizeOut').textContent = `${s}%`
  const o = Number($('#wmOpacity').value)
  $('#wmOpacityOut').textContent = `${Math.round(o * 100)}%`
}

function refreshControlStates() {
  const isCustom = $('#preset').value === 'custom'
  $('#customW').disabled = !isCustom
  $('#customH').disabled = !isCustom
  const preset = CANVAS_PRESETS.find((p) => p.id === $('#preset').value)
  $('#presetHint').textContent = preset ? `${preset.label} · ${preset.sub}` : ''

  const isCover = document.querySelector('[data-fit].active')?.dataset.fit === 'cover'
  $('#bgColor').disabled = isCover

  const isPng = $('#format').value === 'image/png'
  $('#quality').disabled = isPng
  $('#targetKB').disabled = isPng
  $('#qualityRow').classList.toggle('is-disabled', isPng)
  $('#targetRow').classList.toggle('is-disabled', isPng)
  const fmt = OUTPUT_FORMATS.find((f) => f.id === $('#format').value)
  $('#formatHint').textContent = fmt ? fmt.hint : ''
  $('#targetHint').textContent = isPng ? 'PNG 为无损格式，目标大小仅对 JPEG / WebP 生效' : ''

  const wmOn = $('#wmEnable').checked
  $('#wmFields').classList.toggle('is-disabled', !wmOn)
  const tiled = $('#wmTiled').checked
  $('#wmPosGrid').classList.toggle('is-disabled', tiled)
  $('#wmPosLabel').textContent = tiled ? '平铺（位置不生效）' : '位置'
}

/* ------------------------------------------------------------------- queue */

function selectedItem() {
  return state.items.find((i) => i.id === state.selectedId) || null
}

function addFiles(fileList) {
  if (state.busy) return
  const files = Array.from(fileList || [])
  if (!files.length) return
  let accepted = []
  let rejected = 0
  for (const f of files) {
    if (!F.isAcceptedImage(f)) { rejected += 1; continue }
    if (f.size > CONFIG.maxFileMB * 1024 * 1024) {
      toast(`${f.name} 超过单张 ${CONFIG.maxFileMB}MB 上限`, 'alert')
      rejected += 1
      continue
    }
    accepted.push(f)
  }
  if (rejected) toast(`${rejected} 个文件被跳过（格式或大小不支持）`, 'alert')

  // 整批总量上限：避免一次拖入过多文件把内存吃满
  const totalBytes = state.items.reduce((sum, i) => sum + i.bytes, 0)
  const budget = CONFIG.maxTotalMB * 1024 * 1024
  if (totalBytes >= budget) {
    toast(`这一批已达到 ${CONFIG.maxTotalMB}MB 上限，请先处理并清空`, 'alert', 4000)
    return
  }
  let running = totalBytes
  let overBudget = 0
  accepted = accepted.filter((f) => {
    if (running + f.size > budget) { overBudget += 1; return false }
    running += f.size
    return true
  })
  if (overBudget) toast(`${overBudget} 个文件让整批超过 ${CONFIG.maxTotalMB}MB，已跳过`, 'alert', 4000)

  const room = MAX_FILES - state.items.length
  if (room <= 0) {
    showLimitBanner()
    toast(`每批最多 ${MAX_FILES} 张，请先清空或处理`, 'alert')
    return
  }
  let truncated = 0
  if (accepted.length > room) {
    truncated = accepted.length - room
    accepted = accepted.slice(0, room)
  }
  for (const f of accepted) {
    state.items.push({
      id: F.uid('img'),
      file: f,
      name: f.name,
      bytes: f.size,
      status: 'ready',
      error: null,
      result: null,
      thumb: '',
      thumbBusy: false,
      beforeURL: '',
      previewURL: '',
      previewToken: '',
    })
  }
  renderQueue()
  updateDropStats()
  updateActions()
  if (!state.selectedId) selectItem(state.items[0].id)
  if (truncated) {
    showLimitBanner()
    toast(`每批最多 ${MAX_FILES} 张，已加入前 ${accepted.length} 张`, 'alert')
  } else if (accepted.length) {
    toast(`已加入 ${accepted.length} 张图片`, 'success', 1800)
  }
}

function showLimitBanner() {
  if (EDITION === 'offline') return
  const banner = $('#limitBanner')
  $('#limitText').textContent = `在线体验版每批最多 ${MAX_FILES} 张。离线批量版每批 ${CONFIG.offlineMaxFiles} 张，单个 HTML 文件、完全离线。`
  banner.hidden = false
}

function removeItem(id) {
  if (state.busy) return
  const idx = state.items.findIndex((i) => i.id === id)
  if (idx < 0) return
  const [item] = state.items.splice(idx, 1)
  if (item.beforeURL) URL.revokeObjectURL(item.beforeURL)
  if (item.previewURL) URL.revokeObjectURL(item.previewURL)
  if (state.selectedId === id) {
    state.selectedId = state.items[Math.min(idx, state.items.length - 1)]?.id || null
  }
  renderQueue()
  updateDropStats()
  updateActions()
  updatePreview()
}

function clearQueue() {
  if (state.busy) return
  for (const item of state.items) {
    if (item.beforeURL) URL.revokeObjectURL(item.beforeURL)
    if (item.previewURL) URL.revokeObjectURL(item.previewURL)
  }
  state.items = []
  state.selectedId = null
  renderQueue()
  updateDropStats()
  updateActions()
  updatePreview()
  $('#summaryText').textContent = ''
  toast('已清空队列', 'info', 1500)
}

function renderQueue() {
  const list = $('#fileList')
  list.innerHTML = ''
  for (const item of state.items) list.appendChild(renderQueueItem(item))
  $('#queueCount').textContent = String(state.items.length)
  $('#queueEmpty').hidden = state.items.length > 0
  const done = state.items.filter((i) => i.status === 'done')
  const before = state.items.reduce((s, i) => s + i.bytes, 0)
  const after = done.reduce((s, i) => s + (i.result?.afterBytes || 0), 0)
  $('#queueTotalBefore').textContent = F.formatBytes(before)
  $('#queueTotalAfter').textContent = done.length ? F.formatBytes(after) : '—'
}

function renderQueueItem(item) {
  const li = document.createElement('li')
  li.className = `file-item${item.id === state.selectedId ? ' selected' : ''}`
  li.dataset.id = item.id
  li.setAttribute('role', 'button')
  li.setAttribute('tabindex', '0')

  const statusMap = {
    ready: ['待处理', ''],
    processing: ['处理中', 'processing'],
    done: ['完成', 'done'],
    error: ['失败', 'error'],
  }
  const [label, cls] = statusMap[item.status] || statusMap.ready
  const dims = item.result ? `${item.result.width}×${item.result.height}` : ''
  const size = item.result
    ? `${F.formatBytes(item.result.afterBytes)} · ${F.formatDelta(item.bytes, item.result.afterBytes)}`
    : F.formatBytes(item.bytes)
  const miss = item.result && !item.result.hitTarget ? ' <span class="file-warn" title="未能压到目标体积，已输出最接近的结果">!</span>' : ''
  li.innerHTML = `
    <img class="file-thumb" alt="" draggable="false" />
    <div class="file-info">
      <div class="file-name" title="${F.escapeHTML(item.name)}">${F.escapeHTML(item.name)}</div>
      <div class="file-sub">${dims ? dims + ' · ' : ''}${size}${miss}</div>
    </div>
    <span class="file-status ${cls}">${label}</span>
    <button class="file-remove" type="button" aria-label="移除" title="移除">${icon('x', 14)}</button>
  `
  li.querySelector('.file-remove').addEventListener('click', (e) => {
    e.stopPropagation()
    removeItem(item.id)
  })
  li.addEventListener('click', () => {
    selectItem(item.id)
    if (item.status === 'error' && !state.busy) retryItem(item.id)
  })
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(item.id) }
  })
  ensureThumb(item, li.querySelector('.file-thumb'))
  if (item.status === 'error') li.title = item.error || '处理失败'
  return li
}

async function ensureThumb(item, imgEl) {
  if (item.thumb) {
    if (imgEl.isConnected) imgEl.src = item.thumb
    return
  }
  if (item.thumbBusy) return
  item.thumbBusy = true
  try {
    let url = ''
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(item.file, {
          resizeWidth: 96,
          resizeHeight: 96,
          resizeQuality: 'low',
          imageOrientation: 'from-image',
        })
        const c = document.createElement('canvas')
        c.width = bmp.width
        c.height = bmp.height
        c.getContext('2d').drawImage(bmp, 0, 0)
        bmp.close?.()
        url = c.toDataURL('image/jpeg', 0.72)
      } catch { /* 落到 objectURL */ }
    }
    if (!url) url = URL.createObjectURL(item.file)
    item.thumb = url
    if (imgEl.isConnected) imgEl.src = url
  } finally {
    item.thumbBusy = false
  }
}

function selectItem(id) {
  state.selectedId = id
  $$('#fileList .file-item').forEach((el) => el.classList.toggle('selected', el.dataset.id === id))
  const item = selectedItem()
  $('#stageEmpty').hidden = !!item
  updatePreview()
}

function updateDropStats() {
  const total = state.items.reduce((s, i) => s + i.bytes, 0)
  const stats = $('#dropStats')
  if (!state.items.length) {
    stats.innerHTML = `支持 JPEG / PNG / WebP · 单张 ≤ ${CONFIG.maxFileMB}MB · 每批最多 ${MAX_FILES} 张`
  } else {
    stats.innerHTML = `已加入 <b>${state.items.length}</b> / ${MAX_FILES} 张 · 合计 ${F.formatBytes(total)}`
  }
}

/* ----------------------------------------------------------------- preview */

async function updatePreview() {
  const item = selectedItem()
  if (!item) {
    $('#stageEmpty').hidden = false
    $('#stageName').textContent = '—'
    $('#stageDims').textContent = ''
    $('#metaName').textContent = '—'
    $('#metaBefore').textContent = '—'
    $('#metaAfter').textContent = '—'
    $('#metaDelta').textContent = '—'
    $('#metaFile').textContent = '—'
    setStageMode(state.previewMode, null)
    return
  }
  $('#stageEmpty').hidden = true
  $('#stageName').textContent = item.name
  $('#metaName').textContent = item.name
  $('#metaFile').textContent = item.result ? item.result.name : '—'

  if (!item.beforeURL) item.beforeURL = URL.createObjectURL(item.file)

  const needAfter = state.previewMode !== 'before'
  let afterURL = ''
  if (needAfter) {
    const token = JSON.stringify(state.settings)
    if (item.previewToken !== token) {
      if (item.previewURL) URL.revokeObjectURL(item.previewURL)
      try {
        const { canvas, width, height } = await composePreview(item.file, state.settings)
        item.previewURL = await canvasToURL(canvas, 'image/jpeg', 0.85)
        item.previewToken = token
        item.previewWidth = width
        item.previewHeight = height
      } catch (err) {
        toast(`预览失败：${err.message}`, 'alert')
        item.previewToken = token
      }
    }
    afterURL = item.previewURL || ''
  }

  const srcW = item.previewWidth || item.width || '?'
  const srcH = item.previewHeight || item.height || '?'
  $('#metaBefore').textContent = `${srcW}×${srcH} · ${F.formatBytes(item.bytes)}`

  const outW = item.result?.width || item.previewWidth || '—'
  const outH = item.result?.height || item.previewHeight || '—'
  $('#stageDims').textContent = `${outW}×${outH}`
  $('#metaAfter').textContent = item.result
    ? `${outW}×${outH} · ${F.formatBytes(item.result.afterBytes)}`
    : `${outW}×${outH} · 目标 ≤ ${state.settings.targetKB || '—'}KB`
  $('#metaDelta').textContent = item.result
    ? F.formatDelta(item.bytes, item.result.afterBytes)
    : '—'

  setStageMode(state.previewMode, { before: item.beforeURL, after: afterURL })
}

function setStageMode(mode, src) {
  const stage = $('#stage')
  stage.dataset.mode = mode
  stage.dataset.wm = state.settings.wm.enabled ? 'on' : 'off'
  $$('.preview-tab').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode))
  if (!src) return
  $('#imgBefore').src = src.before
  if (src.after) $('#imgAfter').src = src.after
}

function setPreviewMode(mode) {
  state.previewMode = mode
  updatePreview()
}

function setCompare(pct) {
  const p = F.clamp(pct, 0, 100)
  $('#imgAfterWrap').style.clipPath = `inset(0 ${100 - p}% 0 0)`
  $('#compareHandle').style.left = `${p}%`
  $('#compareRange').value = String(Math.round(p))
}

function initCompareSlider() {
  const stage = $('#stage')
  const range = $('#compareRange')
  range.addEventListener('input', () => setCompare(Number(range.value)))

  let dragging = false
  const move = (e) => {
    const rect = stage.getBoundingClientRect()
    setCompare(((e.clientX - rect.left) / rect.width) * 100)
  }
  stage.addEventListener('pointerdown', (e) => {
    if (state.previewMode !== 'compare' || !selectedItem()) return
    dragging = true
    stage.setPointerCapture(e.pointerId)
    move(e)
  })
  stage.addEventListener('pointermove', (e) => { if (dragging) move(e) })
  stage.addEventListener('pointerup', () => { dragging = false })
  stage.addEventListener('pointercancel', () => { dragging = false })
}

/* ---------------------------------------------------------------- process */

function updateActions() {
  const done = state.items.filter((i) => i.status === 'done' && i.result)
  $('#downloadZip').disabled = !done.length || state.busy
  $('#downloadCsv').disabled = !done.length || state.busy
  const sel = selectedItem()
  $('#downloadCurrent').disabled = !sel?.result || state.busy
  const failed = state.items.filter((i) => i.status === 'error').length
  $('#retryFailed').hidden = failed === 0
  $('#retryFailed').disabled = !failed || state.busy
  $('#processBtn').disabled = !state.items.length || state.busy
}

function updateSummary() {
  const done = state.items.filter((i) => i.status === 'done' && i.result)
  if (!done.length) { $('#summaryText').textContent = ''; return }
  const before = done.reduce((s, i) => s + i.bytes, 0)
  const after = done.reduce((s, i) => s + i.result.afterBytes, 0)
  const saved = before ? Math.max(0, (1 - after / before) * 100).toFixed(0) : 0
  $('#summaryText').textContent =
    `已处理 ${done.length}/${state.items.length} 张 · 原始 ${F.formatBytes(before)} → 输出 ${F.formatBytes(after)} · 省 ${saved}%`
}

async function retryItem(id) {
  const item = state.items.find((i) => i.id === id)
  if (!item || state.busy) return
  item.status = 'ready'
  item.error = null
  renderQueue()
  updateActions()
  toast('已重新加入待处理队列，点「开始处理」重试', 'info', 2200)
}

async function retryFailed() {
  if (state.busy) return
  const failed = state.items.filter((i) => i.status === 'error')
  if (!failed.length) return
  for (const item of failed) {
    item.status = 'ready'
    item.error = null
  }
  renderQueue()
  toast(`正在重试 ${failed.length} 张`, 'info', 1500)
  await processAll()
}

async function processAll() {
  if (state.busy) return
  if (!state.items.length) { toast('先添加图片再处理', 'alert'); return }
  const pending = state.items.filter((i) => i.status !== 'done')
  if (!pending.length) { toast('这一批已经处理完成，可直接下载', 'info'); return }

  state.busy = true
  updateActions()
  $('#processBtn').innerHTML = `${icon('refresh', 16)} 处理中…`
  $('#progressBar').style.width = '0%'
  let done = 0
  const total = pending.length

  for (const item of pending) {
    item.status = 'processing'
    item.error = null
    renderQueue()
    $('#statusText').textContent = `正在处理 ${done + 1}/${total}：${item.name}`
    try {
      const result = await processFile(item.file, state.settings, { maxMegapixels: CONFIG.maxMegapixels })
      item.result = result
      item.status = 'done'
    } catch (err) {
      item.status = 'error'
      item.error = err.message
      toast(`${item.name} 处理失败：${err.message}`, 'alert', 4200)
    }
    done += 1
    $('#progressBar').style.width = `${(done / total) * 100}%`
    renderQueue()
    if (state.selectedId === item.id) updatePreview()
  }

  state.busy = false
  $('#processBtn').innerHTML = `${icon('zap', 16)} 开始处理`
  updateActions()
  updateSummary()
  const ok = state.items.filter((i) => i.status === 'done').length
  const fail = state.items.length - ok
  $('#statusText').textContent = fail ? `完成 ${ok} 张，失败 ${fail} 张` : `全部完成，共 ${ok} 张`
  toast(fail ? `完成 ${ok} 张，${fail} 张失败` : `全部完成，共 ${ok} 张`, fail ? 'alert' : 'success')
}

function donePayload() {
  return state.items
    .filter((i) => i.status === 'done' && i.result)
    .map((i) => ({ result: i.result, srcName: i.name, beforeBytes: i.bytes }))
}

async function downloadZip() {
  const payload = donePayload()
  if (!payload.length) return
  const btn = $('#downloadZip')
  const old = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = `${icon('package', 16)} 正在打包…`
  $('#statusText').textContent = '正在打包 ZIP…'
  try {
    const blob = await buildZip(payload, state.settings, {
      version: CONFIG.version,
      edition: EDITION,
      canvas: $('#presetHint').textContent,
    })
    F.download(blob, `tiehao-${EDITION === 'offline' ? 'offline' : 'web'}-${Date.now()}.zip`)
    $('#statusText').textContent = 'ZIP 已生成'
    toast('ZIP 已生成并开始下载', 'success')
  } catch (err) {
    toast(`打包失败：${err.message}`, 'alert')
  } finally {
    btn.disabled = false
    btn.innerHTML = old
    updateActions()
  }
}

function downloadCsv() {
  const payload = donePayload()
  if (!payload.length) return
  const csv = buildManifest(payload, state.settings)
  F.downloadText(csv, 'manifest.csv', 'text/csv')
  toast('清单 CSV 已下载', 'success', 1800)
}

function downloadCurrent() {
  const item = selectedItem()
  if (!item?.result) return
  F.download(item.result.blob, item.result.name)
  toast('当前图片已下载', 'success', 1800)
}

/* ------------------------------------------------------------------ brands */

function refreshBrandSelect() {
  const sel = $('#brandSelect')
  const presets = store.list()
  sel.innerHTML = '<option value="">选择预设…</option>' + presets
    .map((p) => `<option value="${p.id}">${F.escapeHTML(p.name)}</option>`)
    .join('')
  $('#brandLoad').disabled = !presets.length
  $('#brandDelete').disabled = !presets.length
}

function initBrands() {
  refreshBrandSelect()
  $('#brandSave').addEventListener('click', () => {
    const name = $('#brandName').value.trim()
    if (!name) { toast('请先填写预设名称', 'alert'); $('#brandName').focus(); return }
    try {
      store.save(name, state.settings)
      $('#brandName').value = ''
      refreshBrandSelect()
      $('#brandSelect').value = store.list().find((p) => p.name === name)?.id || ''
      toast(`预设「${name}」已保存`, 'success', 1800)
    } catch (err) {
      toast(err.message, 'alert')
    }
  })
  $('#brandLoad').addEventListener('click', () => {
    const preset = store.list().find((p) => p.id === $('#brandSelect').value)
    if (!preset) { toast('请先选择一个预设', 'alert'); return }
    state.settings = normalizeSettings(preset.settings)
    applySettingsToDOM(state.settings)
    saveSettings()
    invalidatePreview()
    toast(`已载入预设「${preset.name}」`, 'success', 1800)
  })
  $('#brandDelete').addEventListener('click', () => {
    const preset = store.list().find((p) => p.id === $('#brandSelect').value)
    if (!preset) return
    if (!window.confirm(`删除预设「${preset.name}」？`)) return
    store.remove(preset.id)
    refreshBrandSelect()
    toast('预设已删除', 'info', 1500)
  })
  $('#brandExport').addEventListener('click', () => {
    const json = store.exportJSON()
    F.downloadText(json, 'tiehao-presets.json', 'application/json')
    toast('预设已导出为 JSON', 'success', 1800)
  })
  $('#brandImportBtn').addEventListener('click', () => $('#brandImport').click())
  $('#brandImport').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const n = store.importJSON(text)
      refreshBrandSelect()
      toast(n ? `已导入 ${n} 个预设` : '没有找到可导入的预设', n ? 'success' : 'alert')
    } catch (err) {
      toast(`导入失败：${err.message}`, 'alert')
    }
  })
}

/* -------------------------------------------------------------- settings UI */

function invalidatePreview() {
  for (const item of state.items) item.previewToken = ''
}

function onSettingsChanged() {
  state.settings = readSettingsFromDOM()
  saveSettings()
  syncSettingOutputs()
  refreshControlStates()
  invalidatePreview()
  updatePreview()
}

function initSettingsPanel() {
  applySettingsToDOM(state.settings)

  $('#preset').addEventListener('change', onSettingsChanged)
  $('#customW').addEventListener('input', onSettingsChanged)
  $('#customH').addEventListener('input', onSettingsChanged)
  $('#bgColor').addEventListener('input', onSettingsChanged)
  $('#format').addEventListener('change', onSettingsChanged)
  $('#quality').addEventListener('input', onSettingsChanged)
  $('#targetKB').addEventListener('input', onSettingsChanged)
  $('#wmText').addEventListener('input', onSettingsChanged)
  $('#wmFont').addEventListener('change', onSettingsChanged)
  $('#wmColor').addEventListener('input', onSettingsChanged)
  $('#wmSize').addEventListener('input', onSettingsChanged)
  $('#wmOpacity').addEventListener('input', onSettingsChanged)
  $('#wmEnable').addEventListener('change', onSettingsChanged)
  $('#wmBold').addEventListener('change', onSettingsChanged)
  $('#wmStroke').addEventListener('change', onSettingsChanged)
  $('#wmTiled').addEventListener('change', onSettingsChanged)

  $$('[data-fit]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-fit]').forEach((b) => b.classList.toggle('active', b === btn))
    onSettingsChanged()
  }))

  $$('[data-pos]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.disabled) return
    $$('[data-pos]').forEach((b) => b.classList.toggle('active', b === btn))
    onSettingsChanged()
  }))

  $('#resetSettings').addEventListener('click', () => {
    state.settings = normalizeSettings({})
    applySettingsToDOM(state.settings)
    saveSettings()
    invalidatePreview()
    updatePreview()
    toast('已恢复默认设置', 'info', 1500)
  })
}

/* ------------------------------------------------------------------- input */

function initInput() {
  const dropzone = $('#dropzone')
  const fileInput = $('#fileInput')

  $('#pickBtn').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click() })
  dropzone.addEventListener('click', (e) => {
    // 只处理落在空白区域/提示文案上的点击，避免按钮冒泡时又弹出一次选择框
    if (e.target.closest('button, input, a, label')) return
    fileInput.click()
  })
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files)
    fileInput.value = ''
  })

  let dragDepth = 0
  for (const ev of ['dragenter', 'dragover']) {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault()
      if (ev === 'dragenter') dragDepth += 1
      dropzone.classList.toggle('drag', true)
    })
  }
  for (const ev of ['dragleave', 'drop']) {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault()
      if (ev === 'dragleave') dragDepth = Math.max(0, dragDepth - 1)
      if (ev === 'drop') {
        dragDepth = 0
        addFiles(e.dataTransfer?.files || [])
      }
      dropzone.classList.toggle('drag', dragDepth > 0)
    })
  }

  document.addEventListener('paste', (e) => {
    const target = e.target
    if (target && target.matches('input, textarea, select, [contenteditable="true"]')) return
    const files = []
    for (const item of e.clipboardData?.items || []) {
      if (item.type && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length) {
      e.preventDefault()
      addFiles(files)
    }
  })

  $('#loadSamples').addEventListener('click', async () => {
    try {
      const files = await makeSampleFiles()
      addFiles(files)
    } catch (err) {
      toast(`示例图生成失败：${err.message}`, 'alert')
    }
  })
  $('#clearSamples').addEventListener('click', clearQueue)
  $('#clearQueue').addEventListener('click', clearQueue)
}

/* -------------------------------------------------------------------- tabs */

function initTabs() {
  $$('.preview-tab').forEach((btn) => btn.addEventListener('click', () => setPreviewMode(btn.dataset.mode)))
}

/* --------------------------------------------------------------------- init */

function initIcons() {
  $$('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, 18)
    el.removeAttribute('data-icon')
  })
}

function initEditionUI() {
  const label = EDITION === 'offline' ? '离线批量版' : '在线体验版'
  $$('[data-edition-label]').forEach((el) => { el.textContent = label })
  $$('[data-max-files]').forEach((el) => { el.textContent = String(MAX_FILES) })
  $$('[data-max-files-offline]').forEach((el) => { el.textContent = String(CONFIG.offlineMaxFiles) })
  $$('[data-max-file-mb]').forEach((el) => { el.textContent = String(CONFIG.maxFileMB) })
  $$('[data-price]').forEach((el) => { el.textContent = String(CONFIG.priceCny) })
  $$('[data-version]').forEach((el) => { el.textContent = CONFIG.version })
  $('#editionBadge').textContent = EDITION === 'offline' ? '离线批量版' : '体验版'
  document.body.classList.toggle('edition-offline', EDITION === 'offline')

  const buyModal = initModal($('#buyModal'))
  const hasCheckout = Boolean(CONFIG.checkoutUrl)
  $('#buyReady').hidden = !hasCheckout
  $('#buyPending').hidden = hasCheckout
  if (hasCheckout) $('#checkoutLink').href = CONFIG.checkoutUrl
  $$('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
    if (EDITION === 'offline') return
    if (hasCheckout) window.open(CONFIG.checkoutUrl, '_blank', 'noopener')
    else buyModal.open()
  }))
  $('#buyClose').addEventListener('click', () => buyModal.close())
}

async function initHeroMock() {
  const img = $('#heroMockImg')
  if (!img) return
  try {
    // 英雄区用「处理前 → 处理后」的真实示例，而不是原图
    const [bytes] = [await makeSampleSource(0)]
    const file = new File([bytes], 'hero.jpg', { type: 'image/jpeg' })
    const { canvas } = await composePreview(file, {
      ...state.settings,
      preset: 'portrait34',
      fit: 'contain',
      wm: { ...state.settings.wm, enabled: true, text: '@你的品牌', pos: 'br', size: 4.5, opacity: 0.8 },
    })
    const url = await canvasToURL(canvas, 'image/jpeg', 0.86)
    img.src = url
  } catch { /* 英雄区保持占位 */ }
}

function init() {
  initIcons()
  initEditionUI()
  initSettingsPanel()
  initInput()
  initTabs()
  initCompareSlider()
  initBrands()
  initReveal()
  initCountUp()
  initNavScroll()

  $('#processBtn').addEventListener('click', processAll)
  $('#downloadZip').addEventListener('click', downloadZip)
  $('#downloadCsv').addEventListener('click', downloadCsv)
  $('#downloadCurrent').addEventListener('click', downloadCurrent)
  $('#retryFailed').addEventListener('click', retryFailed)

  renderQueue()
  updateDropStats()
  updateActions()
  updatePreview()
  initHeroMock()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
