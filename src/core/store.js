import { uid } from './format.js'
import { normalizeSettings } from './settings.js'

const STORAGE_KEY = 'tiehao.brandPresets.v1'

function safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch { /* file:// 或隐私模式下可能抛错 */ }
  return memoryStorage()
}

function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

/**
 * 品牌预设仓库。预设 = { id, name, settings, createdAt }。
 * storage 可注入，便于测试。
 */
export function createPresetStore(storage = safeStorage(), key = STORAGE_KEY) {
  function readAll() {
    try {
      const raw = storage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((p) => p && typeof p === 'object') : []
    } catch {
      return []
    }
  }

  function writeAll(list) {
    storage.setItem(key, JSON.stringify(list))
  }

  function list() {
    return readAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  function save(name, settings) {
    const cleanName = String(name || '').trim().slice(0, 24)
    if (!cleanName) throw new Error('请填写预设名称')
    const presets = readAll()
    const existing = presets.find((p) => p.name === cleanName)
    const record = {
      id: existing?.id || uid('preset'),
      name: cleanName,
      settings: normalizeSettings(settings),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }
    const next = existing
      ? presets.map((p) => (p.id === record.id ? record : p))
      : [...presets, record]
    writeAll(next)
    return record
  }

  function remove(id) {
    writeAll(readAll().filter((p) => p.id !== id))
  }

  function exportJSON() {
    return JSON.stringify({ app: 'tiehao', kind: 'brand-presets', version: 1, presets: list() }, null, 2)
  }

  /** 导入 JSON 文本，返回导入数量。支持单个预设对象或预设数组。 */
  function importJSON(text) {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data
      : Array.isArray(data?.presets) ? data.presets
        : [data]
    const presets = readAll()
    let count = 0
    for (const item of arr) {
      const name = String(item?.name || '').trim().slice(0, 24)
      if (!name) continue
      const record = {
        id: uid('preset'),
        name,
        settings: normalizeSettings(item.settings || item),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      presets.push(record)
      count += 1
    }
    if (count) writeAll(presets)
    return count
  }

  return { list, save, remove, exportJSON, importJSON, key }
}
