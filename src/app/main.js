import { config } from '../config.js'
import {
  normalizeSettings,
  DEFAULT_SETTINGS,
  CANVAS_PRESETS,
  OUTPUT_FORMATS,
  WM_POSITIONS,
} from '../core/settings.js'
import { createPresetStore } from '../core/store.js'
import { processFile, processFileToTargets, composePreview, canvasToURL, decodeImage, decodeLogoImage } from '../core/pipeline.js'
import { PLATFORM_PRESETS, PLATFORM_GROUPS, normalizeTargets, targetSummary, platformGlyph, findPreset, safeRect, unionSafeArea } from '../core/platforms.js'
import { LAYOUTS, TONES, DEFAULT_COPY, parsePoints } from '../core/typography.js'
import { buildZip, buildManifest } from '../core/zip.js'
import { makeSampleFiles, makeSampleSource } from '../core/samples.js'
import * as F from '../core/format.js'
import { icon } from './icons.js'
import { toast, initModal, initReveal, initCountUp, initNavScroll } from './ui.js'
import { createLocks } from './locks.js'

const CONFIG = { ...config, ...(window.__TIEHAO_CONFIG__ || {}) }
const EDITION = CONFIG.edition === 'offline' ? 'offline' : 'web'
const MAX_FILES = EDITION === 'offline' ? CONFIG.offlineMaxFiles : CONFIG.webMaxFiles
const SETTINGS_KEY = 'tiehao.settings.v1'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const store = createPresetStore()

// 购买弹窗的 open(label) 由 initEditionUI 注入，locks 用它统一拉起付费说明
let buyModalRef = { open() {}, close() {} }
const locks = createLocks({
  edition: EDITION,
  config: CONFIG,
  openBuy: () => buyModalRef.open(),
})

const state = {
  settings: loadSettings(),
  items: [],
  selectedId: null,
  previewMode: 'after',
  busy: false,
  previewToken: '',
  safeGuide: false,
  logoImage: null,      // 已解码的品牌 logo
  logoImageSrc: '',     // 对应 dataURL，避免重复解码
  gridResults: [],      // 「全部产出」网格
  gridBusy: false,
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
    targets: state.settings.targets,
    focus: state.settings.focus,
    trim: {
      enabled: $('#trimEnable').checked,
      bg: $('#trimBg').value,
      tolerance: $('#trimTolerance').value,
    },
    copy: {
      ...state.settings.copy,
      layout: $('#copyLayout').value,
      tone: $('#copyTone').value,
      customBg: $('#copyBg').value,
      customFg: $('#copyFg').value,
      customAccent: $('#copyAccent').value,
      title: $('#copyEnable').checked ? $('#copyTitle').value : '',
      subtitle: $('#copyEnable').checked ? $('#copySubtitle').value : '',
      points: $('#copyEnable').checked ? $('#copyPoints').value : '',
      badge: $('#copyEnable').checked ? $('#copyBadge').value : '',
      price: $('#copyEnable').checked ? $('#copyPrice').value : '',
      priceNote: $('#copyEnable').checked ? $('#copyPriceNote').value : '',
      footer: $('#copyEnable').checked ? $('#copyFooter').value : '',
      align: document.querySelector('[data-align].active')?.dataset.align || 'left',
      scale: $('#copyScale').value,
      scrim: $('#copyScrim').value,
    },
    logo: {
      ...state.settings.logo,
      enabled: $('#logoEnable').checked,
      mode: document.querySelector('[data-logo-mode].active')?.dataset.logoMode || 'text',
      text: $('#logoText').value,
      pos: document.querySelector('[data-logo-pos].active')?.dataset.logoPos || 'tl',
      size: $('#logoSize').value,
      opacity: $('#logoOpacity').value,
      plate: $('#logoPlate').checked,
    },
    nameTemplate: $('#nameTemplate').value,
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
  applyAdvancedToDOM(settings)
  syncSettingOutputs()
  refreshControlStates()
}

function applyAdvancedToDOM(settings) {
  const c = settings.copy
  const l = settings.logo
  const hasCopy = Boolean(c.title || c.price || c.badge || c.subtitle)
  $('#copyEnable').checked = hasCopy
  $('#copyLayout').value = c.layout
  $('#copyTone').value = c.tone
  $('#copyBg').value = c.customBg
  $('#copyFg').value = c.customFg
  $('#copyAccent').value = c.customAccent
  $('#copyTitle').value = c.title
  $('#copySubtitle').value = c.subtitle
  $('#copyPoints').value = c.points
  $('#copyBadge').value = c.badge
  $('#copyPrice').value = c.price
  $('#copyPriceNote').value = c.priceNote
  $('#copyFooter').value = c.footer
  $('#copyScale').value = c.scale
  $('#copyScrim').value = c.scrim
  $$('[data-align]').forEach((b) => b.classList.toggle('active', b.dataset.align === c.align))

  $('#logoEnable').checked = l.enabled
  $('#logoText').value = l.text
  $('#logoSize').value = l.size
  $('#logoOpacity').value = l.opacity
  $('#logoPlate').checked = l.plate
  $$('[data-logo-mode]').forEach((b) => b.classList.toggle('active', b.dataset.logoMode === l.mode))
  $$('[data-logo-pos]').forEach((b) => b.classList.toggle('active', b.dataset.logoPos === l.pos))
  renderLogoPreview()

  $('#trimEnable').checked = settings.trim.enabled
  $('#trimBg').value = settings.trim.bg
  $('#trimTolerance').value = settings.trim.tolerance
  $('#nameTemplate').value = settings.nameTemplate
  $('#safeGuide').checked = Boolean(state.safeGuide)
  syncFocusPad()
  renderTargetList()
}

function syncSettingOutputs() {
  const q = Number($('#quality').value)
  $('#qualityOut').textContent = q.toFixed(2)
  const s = Number($('#wmSize').value)
  $('#wmSizeOut').textContent = `${s}%`
  const o = Number($('#wmOpacity').value)
  $('#wmOpacityOut').textContent = `${Math.round(o * 100)}%`

  const cs = Number($('#copyScale').value)
  $('#copyScaleOut').textContent = `${Math.round(cs * 100)}%`
  const sc = Number($('#copyScrim').value)
  $('#copyScrimOut').textContent = `${Math.round(sc * 100)}%`
  const ls = Number($('#logoSize').value)
  $('#logoSizeOut').textContent = `${ls}%`
  const lo = Number($('#logoOpacity').value)
  $('#logoOpacityOut').textContent = `${Math.round(lo * 100)}%`
  const tt = Number($('#trimTolerance').value)
  $('#trimToleranceOut').textContent = String(tt)
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

  // 焦点只在「铺满裁切」时有意义；在线版锁定
  const focusLocked = locks.featureLocked('focus')
  $('#focusField').classList.toggle('is-disabled', !isCover || focusLocked)
  if (focusLocked) $('#focusField').setAttribute('title', '裁切焦点属于离线批量版')
  $('#focusPad').classList.toggle('is-disabled', !isCover)

  // 付费能力：禁用开关 + 显示锁标记
  for (const [id, feature, label] of [
    ['copyEnable', 'copy', '文案排版'],
    ['logoEnable', 'logo', '品牌标识'],
    ['trimEnable', 'trim', '白边裁剪'],
  ]) {
    const el = $('#' + id)
    const locked = locks.featureLocked(feature)
    el.disabled = locked
    el.closest('.check')?.classList.toggle('is-locked', locked)
    el.closest('.check')?.setAttribute('title', locked ? `${label}属于离线批量版` : '')
  }

  // 文案层
  const copyOn = $('#copyEnable').checked
  $('#copyFields').classList.toggle('is-disabled', !copyOn)
  const layout = LAYOUTS.find((x) => x.id === $('#copyLayout').value)
  $('#copyLayoutHint').textContent = layout ? layout.hint : ''
  $('#copyCustomColors').hidden = $('#copyTone').value !== 'custom'

  // 品牌标识
  const logoOn = $('#logoEnable').checked
  $('#logoFields').classList.toggle('is-disabled', !logoOn)
  const logoMode = document.querySelector('[data-logo-mode].active')?.dataset.logoMode || 'text'
  $('#logoTextField').hidden = logoMode !== 'text'
  $('#logoImageField').hidden = logoMode !== 'image'

  // 白边裁剪
  $('#trimFields').classList.toggle('is-disabled', !$('#trimEnable').checked)

  // 安全区提示
  updateSafeHint()
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
  const outs = item.outputResults?.length || (item.result ? 1 : 0)
  const totalAfter = item.outputResults?.length
    ? item.outputResults.reduce((sum, o) => sum + (o.result?.afterBytes || 0), 0)
    : item.result?.afterBytes || 0
  const size = outs
    ? `${outs > 1 ? `${outs} 份 · ` : ''}${F.formatBytes(totalAfter)} · ${F.formatDelta(item.bytes, totalAfter)}`
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
  const targets = currentTargets()

  if (!item) {
    $('#stageEmpty').hidden = false
    $('#stageName').textContent = '—'
    $('#stageDims').textContent = ''
    $('#metaName').textContent = '—'
    $('#metaBefore').textContent = '—'
    $('#metaAfter').textContent = '—'
    $('#metaDelta').textContent = '—'
    $('#metaFile').textContent = '—'
    renderGrid([])
    setStageMode(state.previewMode, null)
    return
  }

  $('#stageEmpty').hidden = true
  $('#stageName').textContent = item.name
  $('#metaName').textContent = item.name

  if (!item.beforeURL) item.beforeURL = URL.createObjectURL(item.file)

  // 预览以第一个目标规格为准（没有目标则用自定义画布）
  const preset = targets[0] || null
  const needAfter = state.previewMode !== 'before'
  let afterURL = ''
  if (needAfter) {
    const token = JSON.stringify({ s: state.settings, t: targets.map((t) => t.id), g: state.safeGuide })
    if (item.previewToken !== token) {
      if (item.previewURL) URL.revokeObjectURL(item.previewURL)
      try {
        const logoImage = await ensureLogoImage()
        const { canvas, width, height } = await composePreview(item.file, state.settings, {
          preset,
          logoImage,
          safeGuide: state.safeGuide && Boolean(preset),
        })
        item.previewURL = await canvasToURL(canvas, 'image/jpeg', 0.86)
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

  const srcW = item.width || '?'
  const srcH = item.height || '?'
  $('#metaBefore').textContent = `${srcW}×${srcH} · ${F.formatBytes(item.bytes)}`

  const outs = item.outputResults?.length ? item.outputResults : null
  const first = outs ? outs[0]?.result : item.result
  const outW = first?.width || item.previewWidth || '—'
  const outH = first?.height || item.previewHeight || '—'
  $('#stageDims').textContent = outs
    ? `${outs.length} 份 · ${outW}×${outH}${outs.length > 1 ? ' 等' : ''}`
    : `${outW}×${outH}`

  $('#metaFile').textContent = outs
    ? outs.map((o) => o.result?.name).filter(Boolean).join(' / ')
    : item.result ? item.result.name : '—'

  const totalAfter = outs
    ? outs.reduce((sum, o) => sum + (o.result?.afterBytes || 0), 0)
    : item.result?.afterBytes || 0
  const okCount = outs ? outs.filter((o) => o.result).length : item.result ? 1 : 0

  $('#metaAfter').textContent = okCount
    ? `${okCount} 份 · 合计 ${F.formatBytes(totalAfter)}`
    : `${outW}×${outH} · 目标 ≤ ${state.settings.targetKB || '—'}KB`
  $('#metaDelta').textContent = okCount
    ? F.formatDelta(item.bytes, totalAfter)
    : '—'

  $('#stageTagAfter').textContent = preset ? `${preset.platform} ${preset.name}` : '效果'

  renderGrid(outs || (item.result ? [{ preset, result: item.result }] : []))
  setStageMode(state.previewMode, { before: item.beforeURL, after: afterURL })
}

/** 「全部产出」网格：列出当前图片每份目标的结果。 */
function renderGrid(list) {
  const grid = $('#stageGrid')
  if (!grid) return
  if (state.previewMode !== 'grid') {
    grid.hidden = true
    return
  }
  grid.hidden = false
  if (!list.length) {
    grid.innerHTML = '<p class="stage-grid-empty">先处理一次，或切到「效果」查看单张预览</p>'
    return
  }
  grid.innerHTML = list.map((entry, i) => {
    const p = entry.preset
    const r = entry.result
    const title = p ? `${p.platform} · ${p.name}` : '自定义画布'
    const sub = r ? `${r.width}×${r.height} · ${F.formatBytes(r.afterBytes)}` : (entry.error || '未生成')
    const badge = r
      ? (r.hitTarget ? '已达目标' : '未达目标')
      : '失败'
    return `
      <div class="grid-card${i === 0 ? ' is-selected' : ''}" data-grid-index="${i}">
        <img alt="${F.escapeHTML(title)} 预览" src="${entry.url || ''}" loading="lazy" />
        <div class="gc-body">
          <div class="gc-title" title="${F.escapeHTML(title)}">${F.escapeHTML(title)}</div>
          <div class="gc-sub">${F.escapeHTML(sub)}</div>
          <span class="gc-badge${r && !r.hitTarget ? ' miss' : ''}">${badge}</span>
        </div>
      </div>
    `
  }).join('')
}

function setStageMode(mode, src) {
  const stage = $('#stage')
  stage.dataset.mode = mode
  stage.dataset.wm = state.settings.wm.enabled ? 'on' : 'off'
  $$('.preview-tab').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode))

  const wrap = document.querySelector('.stage-wrap')
  const grid = $('#stageGrid')
  const isGrid = mode === 'grid'
  if (stage) stage.hidden = isGrid
  if (wrap) wrap.classList.toggle('is-grid', isGrid)

  if (isGrid) {
    const item = selectedItem()
    const list = item?.outputResults || (item?.result ? [{ preset: currentTargets()[0] || null, result: item.result }] : [])
    renderGrid(list)
  } else if (grid) {
    grid.hidden = true
  }

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

  const targets = currentTargets()
  const badge = $('#outputBadge')
  if (badge) {
    badge.textContent = targets.length ? `${targets.length} 个目标` : '单目标'
    badge.className = `badge${targets.length ? ' targets' : ''}`
  }
  const btn = $('#processBtn')
  const label = targets.length > 1 ? `开始处理 · ${targets.length} 份/张` : '开始处理'
  if (!state.busy) btn.innerHTML = `${icon('zap', 16)} ${label}`
}

function updateSummary() {
  const done = state.items.filter((i) => i.status === 'done' && i.result)
  if (!done.length) { $('#summaryText').textContent = ''; return }
  const before = done.reduce((s, i) => s + i.bytes, 0)
  const after = done.reduce(
    (s, i) => s + (i.outputResults?.reduce((x, o) => x + (o.result?.afterBytes || 0), 0) || i.result.afterBytes),
    0,
  )
  const outs = done.reduce((s, i) => s + (i.outputResults?.length || 1), 0)
  const saved = before ? Math.max(0, (1 - after / before) * 100).toFixed(0) : 0
  $('#summaryText').textContent =
    `已处理 ${done.length}/${state.items.length} 张 · 产出 ${outs} 份 · 原始 ${F.formatBytes(before)} → 输出 ${F.formatBytes(after)} · 省 ${saved}%`
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

  const targets = currentTargets()
  const perTarget = targets.length || 1
  const totalSteps = pending.length * perTarget
  let step = 0

  state.busy = true
  updateActions()
  $('#processBtn').innerHTML = `${icon('refresh', 16)} 处理中…`
  $('#progressBar').style.width = '0%'
  const logoImage = await ensureLogoImage()

  for (const item of pending) {
    item.status = 'processing'
    item.error = null
    item.outputResults = []
    renderQueue()
    $('#statusText').textContent = targets.length > 1
      ? `正在处理 ${item.name} · ${targets.length} 个目标`
      : `正在处理 ${item.name}`

    try {
      if (targets.length) {
        // 一图多版：同一张原图输出多套规格
        const results = []
        for (let t = 0; t < targets.length; t += 1) {
          const res = await processFile(item.file, state.settings, {
            maxMegapixels: CONFIG.maxMegapixels,
            preset: targets[t],
            logoImage,
            template: state.settings.nameTemplate,
            index: t + 1,
          })
          results.push({ preset: targets[t], result: res })
          step += 1
          $('#progressBar').style.width = `${(step / totalSteps) * 100}%`
          $('#statusText').textContent = `正在处理 ${item.name} · ${t + 1}/${targets.length}`
        }
        item.outputResults = results
        item.result = results[0].result
        item.status = 'done'
      } else {
        const result = await processFile(item.file, state.settings, {
          maxMegapixels: CONFIG.maxMegapixels,
          logoImage,
          template: state.settings.nameTemplate,
          index: 1,
        })
        item.result = result
        item.outputResults = [{ preset: null, result }]
        item.status = 'done'
        step += 1
        $('#progressBar').style.width = `${(step / totalSteps) * 100}%`
      }
    } catch (err) {
      item.status = 'error'
      item.error = err.message
      item.outputResults = []
      step += perTarget
      toast(`${item.name} 处理失败：${err.message}`, 'alert', 4200)
    }
    renderQueue()
    if (state.selectedId === item.id) updatePreview()
    // 让出主线程，避免大图批次把 UI 卡死
    await new Promise((r) => setTimeout(r, 0))
  }

  state.busy = false
  $('#processBtn').innerHTML = `${icon('zap', 16)} 开始处理`
  updateActions()
  updateSummary()
  const ok = state.items.filter((i) => i.status === 'done').length
  const fail = state.items.length - ok
  const totalOut = state.items
    .filter((i) => i.status === 'done')
    .reduce((sum, i) => sum + (i.outputResults?.length || 0), 0)
  $('#statusText').textContent = fail
    ? `完成 ${ok} 张，失败 ${fail} 张`
    : `全部完成，共 ${ok} 张 · 产出 ${totalOut} 份`
  toast(fail ? `完成 ${ok} 张，${fail} 张失败` : `全部完成，共产出 ${totalOut} 份`, fail ? 'alert' : 'success')
}

function donePayload() {
  const payload = []
  for (const item of state.items) {
    if (item.status !== 'done') continue
    const list = item.outputResults?.length
      ? item.outputResults
      : [{ preset: null, result: item.result }]
    for (const entry of list) {
      if (!entry?.result) continue
      payload.push({
        result: entry.result,
        srcName: item.name,
        beforeBytes: item.bytes,
        platform: entry.preset?.platform || '',
        targetName: entry.preset?.name || '',
      })
    }
  }
  return payload
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
    const targets = currentTargets()
    const blob = await buildZip(payload, state.settings, {
      version: CONFIG.version,
      edition: EDITION,
      canvas: $('#presetHint').textContent,
      targets: targets.length
        ? [...new Set(targets.map((t) => `${t.platform} ${t.name}`))]
        : [],
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
  const list = (item.outputResults || []).filter((o) => o.result)
  if (list.length > 1) {
    // 多目标：逐个触发下载（浏览器会依次提示保存位置）
    list.forEach((entry, i) => {
      setTimeout(() => F.download(entry.result.blob, entry.result.name), i * 350)
    })
    toast(`正在下载 ${list.length} 份产出`, 'success', 2000)
    return
  }
  F.download(item.result.blob, item.result.name)
  toast('当前图片已下载', 'success', 1800)
}

/* --------------------------------------------------------------- 文案选项 */

function initCopyOptions() {
  const layoutSel = $('#copyLayout')
  layoutSel.innerHTML = LAYOUTS.map((l) => `<option value="${l.id}">${F.escapeHTML(l.label)}</option>`).join('')
  const toneSel = $('#copyTone')
  toneSel.innerHTML = TONES.map((t) => `<option value="${t.id}">${F.escapeHTML(t.label)}</option>`).join('')
}

/* ------------------------------------------------------- targets / 一图多版 */

function currentTargets() {
  return normalizeTargets(state.settings.targets)
}

function renderTargetList() {
  const list = $('#targetList')
  if (!list) return
  const query = ($('#targetSearch')?.value || '').trim().toLowerCase()
  const active = new Set(state.settings.targets)
  const html = []
  let shown = 0
  const lockedCount = PLATFORM_PRESETS.filter((p) => !locks.targetAllowed(p.id)).length
  const glyphSvg = (id) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${platformGlyph(id)}</svg>`
  const checkSvg = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>'
  const lockSvg = () => '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>'

  for (const group of PLATFORM_GROUPS) {
    const presets = PLATFORM_PRESETS.filter((p) => p.platform === group)
    const matched = presets.filter((p) => {
      if (!query) return true
      return (
        p.platform.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        `${p.w}x${p.h}`.includes(query)
      )
    })
    if (!matched.length) continue
    html.push(`<div class="target-group-label">${F.escapeHTML(group)}</div>`)
    for (const p of matched) {
      shown += 1
      const on = active.has(p.id)
      const locked = !locks.targetAllowed(p.id)
      html.push(`
        <button class="target-item${locked ? ' is-locked' : ''}" type="button" role="checkbox" aria-checked="${on}" aria-pressed="${on}" data-target="${p.id}" data-locked="${locked}" title="${F.escapeHTML(locked ? '离线批量版解锁' : (p.note || ''))}">
          <span class="t-glyph">${glyphSvg(p.id)}</span>
          <span class="t-check">${on ? checkSvg : (locked ? lockSvg() : '')}</span>
          <span class="t-name">${F.escapeHTML(p.name)}</span>
          <span class="t-size">${locked ? '离线版' : `${p.w}×${p.h}`}</span>
        </button>
      `)
    }
  }

  list.innerHTML = shown ? html.join('') : '<p class="target-empty">没有匹配的平台，换个关键词试试</p>'
  list.querySelectorAll('[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => toggleTarget(btn.dataset.target))
  })

  const targets = currentTargets()
  const lockNote = lockedCount && !locks.offline ? ` · 另有 ${lockedCount} 个平台需离线版` : ''
  $('#targetSummary').textContent = targets.length
    ? `${targetSummary(targets)} · 每张图将输出 ${targets.length} 份${lockNote}`
    : `未选择目标（使用自定义画布单张输出）${lockNote}`
  $('#targetSummary').classList.toggle('is-empty', targets.length === 0)
  updateSafeHint()
}

function toggleTarget(id) {
  const preset = findPreset(id)
  const set = new Set(state.settings.targets)
  const adding = !set.has(id)
  if (adding && preset) {
    if (!locks.requireTarget(id, `${preset.platform} ${preset.name}`)) return
  }
  if (adding) set.add(id)
  else set.delete(id)
  const max = locks.maxTargets()
  if (set.size > max) {
    toast(`${EDITION === 'offline' ? '离线版' : '在线版'}一次最多选 ${max} 个目标，先取消几个`, 'alert', 3000)
    return
  }
  state.settings.targets = [...set]
  saveSettings()
  renderTargetList()
  invalidatePreview()
  updatePreview()
  updateActions()
}

function updateSafeHint() {
  const hint = $('#safeHint')
  if (!hint) return
  const targets = currentTargets()
  if (!targets.length) {
    hint.textContent = ''
    return
  }
  const area = unionSafeArea(targets)
  hint.textContent = `安全区：上 ${(area.top * 100).toFixed(0)}% · 下 ${(area.bottom * 100).toFixed(0)}% · 左 ${(area.left * 100).toFixed(0)}% · 右 ${(area.right * 100).toFixed(0)}%`
}

function initTargets() {
  renderTargetList()
  $('#targetSearch').addEventListener('input', renderTargetList)
  $('#targetClear').addEventListener('click', () => {
    state.settings.targets = []
    saveSettings()
    renderTargetList()
    invalidatePreview()
    updatePreview()
  })
  $('#nameTemplate').addEventListener('input', () => {
    state.settings = readSettingsFromDOM()
    saveSettings()
  })
  $('#safeGuide').addEventListener('change', () => {
    state.safeGuide = $('#safeGuide').checked
    invalidatePreview()
    updatePreview()
  })
}

/* --------------------------------------------------------------- 焦点裁切 */

function initFocusPad() {
  const pad = $('#focusPad')
  const dot = $('#focusDot')
  if (!pad || !dot) return

  const setFromEvent = (e) => {
    const rect = pad.getBoundingClientRect()
    const x = F.clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const y = F.clamp((e.clientY - rect.top) / rect.height, 0, 1)
    state.settings.focus = { x, y }
    syncFocusPad()
    saveSettings()
    invalidatePreview()
    schedulePreview()
  }

  let dragging = false
  pad.addEventListener('pointerdown', (e) => {
    if (pad.classList.contains('is-disabled')) return
    dragging = true
    pad.setPointerCapture(e.pointerId)
    setFromEvent(e)
  })
  pad.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e) })
  pad.addEventListener('pointerup', () => { dragging = false })
  pad.addEventListener('pointercancel', () => { dragging = false })

  $('#focusReset').addEventListener('click', () => {
    state.settings.focus = { x: 0.5, y: 0.5 }
    syncFocusPad()
    saveSettings()
    invalidatePreview()
    updatePreview()
  })
}

function syncFocusPad() {
  const dot = $('#focusDot')
  if (!dot) return
  const f = state.settings.focus || { x: 0.5, y: 0.5 }
  dot.style.left = `${f.x * 100}%`
  dot.style.top = `${f.y * 100}%`
}

let previewTimer = 0
function schedulePreview(delay = 220) {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { updatePreview() }, delay)
}

/* --------------------------------------------------------------- 品牌标识 */

function renderLogoPreview() {
  const holder = $('#logoImageHint')
  const l = state.settings.logo
  if (!holder) return
  if (l.mode === 'image' && l.imageDataUrl) {
    holder.innerHTML = `<span class="logo-preview"><img src="${l.imageDataUrl}" alt="已上传的品牌标识" /></span>已载入 ${Math.round(l.imageDataUrl.length / 1024)}KB 的图片标识`
  } else if (l.mode === 'image') {
    holder.textContent = '建议使用透明背景 PNG，宽度 ≥ 400px。'
  } else {
    holder.textContent = '建议使用透明背景 PNG，宽度 ≥ 400px。'
  }
}

async function ensureLogoImage() {
  const l = state.settings.logo
  if (!l || !l.enabled || l.mode !== 'image' || !l.imageDataUrl) return null
  if (state.logoImage && state.logoImageSrc === l.imageDataUrl) return state.logoImage
  state.logoImage = await decodeLogoImage(l)
  state.logoImageSrc = l.imageDataUrl
  return state.logoImage
}

function initLogo() {
  $('#logoPick').addEventListener('click', () => $('#logoInput').click())
  $('#logoInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|webp|jpeg)$/.test(file.type)) {
      toast('请选择 PNG / WebP / JPEG 图片', 'alert')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast('标识图片请控制在 1.5MB 以内', 'alert')
      return
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    state.settings.logo.imageDataUrl = dataUrl
    state.settings.logo.enabled = true
    state.logoImage = null
    state.logoImageSrc = ''
    $('#logoEnable').checked = true
    onSettingsChanged()
    toast('品牌标识已更新', 'success', 1600)
  })
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

let settingsTimer = 0
function debounceSettings() {
  syncSettingOutputs()
  clearTimeout(settingsTimer)
  settingsTimer = setTimeout(onSettingsChanged, 260)
}

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

  // 付费能力被锁时，点击开关直接引导购买（而不是毫无反应）
  for (const [id, feature, label] of [
    ['copyEnable', 'copy', '文案排版'],
    ['logoEnable', 'logo', '品牌标识'],
    ['trimEnable', 'trim', '白边裁剪'],
  ]) {
    $('#' + id).closest('.check')?.addEventListener('click', (e) => {
      if (!locks.featureLocked(feature)) return
      e.preventDefault()
      locks.requireFeature(feature, label)
    })
  }

  // 文案层
  $('#copyEnable').addEventListener('change', onSettingsChanged)
  $('#copyLayout').addEventListener('change', onSettingsChanged)
  $('#copyTone').addEventListener('change', onSettingsChanged)
  $('#copyBg').addEventListener('input', onSettingsChanged)
  $('#copyFg').addEventListener('input', onSettingsChanged)
  $('#copyAccent').addEventListener('input', onSettingsChanged)
  for (const id of ['copyTitle', 'copySubtitle', 'copyPoints', 'copyBadge', 'copyPrice', 'copyPriceNote', 'copyFooter']) {
    $('#' + id).addEventListener('input', debounceSettings)
  }
  $('#copyScale').addEventListener('input', debounceSettings)
  $('#copyScrim').addEventListener('input', debounceSettings)
  $$('[data-align]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-align]').forEach((b) => b.classList.toggle('active', b === btn))
    onSettingsChanged()
  }))

  // 品牌标识
  $('#logoEnable').addEventListener('change', onSettingsChanged)
  $('#logoText').addEventListener('input', debounceSettings)
  $('#logoSize').addEventListener('input', debounceSettings)
  $('#logoOpacity').addEventListener('input', debounceSettings)
  $('#logoPlate').addEventListener('change', onSettingsChanged)
  $$('[data-logo-mode]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-logo-mode]').forEach((b) => b.classList.toggle('active', b === btn))
    onSettingsChanged()
  }))
  $$('[data-logo-pos]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-logo-pos]').forEach((b) => b.classList.toggle('active', b === btn))
    onSettingsChanged()
  }))

  // 白边裁剪
  $('#trimEnable').addEventListener('change', onSettingsChanged)
  $('#trimBg').addEventListener('input', onSettingsChanged)
  $('#trimTolerance').addEventListener('input', debounceSettings)

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

  // 离线版已经买断：隐藏所有购买入口与价格区，避免「买了还被推销」
  if (EDITION === 'offline') {
    $$('[data-buy]').forEach((el) => { el.hidden = true })
    $('#pricing')?.setAttribute('hidden', '')
    const navBuy = document.querySelector('.site-header [data-buy]')
    if (navBuy) navBuy.hidden = true
  }

  // 价格区的 ROI 估算：按「每批 3 平台 × 9 张图 × 2 分钟手工」计算
  const roiMinutes = 9 * 3 * 2
  const roiEl = $('#roiMinutes')
  if (roiEl) roiEl.textContent = `${roiMinutes} 分钟+`
  const savedEl = $('#roiSaved')
  if (savedEl) savedEl.textContent = `约 ${Math.round(roiMinutes * 0.9)} 分钟`

  const buyModal = initModal($('#buyModal'))
  buyModalRef = buyModal
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
  initCopyOptions()
  initSettingsPanel()
  initTargets()
  initFocusPad()
  initLogo()
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
