import { describe, it, expect, beforeEach } from 'vitest'
import { createPresetStore } from '../src/core/store.js'
import { DEFAULT_SETTINGS } from '../src/core/settings.js'

function memory() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

describe('createPresetStore', () => {
  let store
  beforeEach(() => { store = createPresetStore(memory(), 'test.key') })

  it('保存 / 列出 / 删除', () => {
    expect(store.list()).toHaveLength(0)
    store.save('主号', { ...DEFAULT_SETTINGS, preset: 'square11' })
    store.save('副号', DEFAULT_SETTINGS)
    const list = store.list()
    expect(list).toHaveLength(2)
    expect(list.map((p) => p.name)).toContain('主号')
    store.remove(list[0].id)
    expect(store.list()).toHaveLength(1)
  })

  it('同名保存会更新而不是重复', () => {
    store.save('主号', DEFAULT_SETTINGS)
    store.save('主号', { ...DEFAULT_SETTINGS, targetKB: 123 })
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].settings.targetKB).toBe(123)
  })

  it('空名字报错', () => {
    expect(() => store.save('  ', DEFAULT_SETTINGS)).toThrow()
  })

  it('导出再导入', () => {
    store.save('主号', { ...DEFAULT_SETTINGS, preset: 'vertical916' })
    const json = store.exportJSON()
    const store2 = createPresetStore(memory(), 'other.key')
    const n = store2.importJSON(json)
    expect(n).toBe(1)
    expect(store2.list()[0].name).toBe('主号')
    expect(store2.list()[0].settings.preset).toBe('vertical916')
  })

  it('导入会过滤无效条目并归一化设置', () => {
    const n = store.importJSON(JSON.stringify({
      presets: [
        { name: '好', settings: { preset: 'custom', customW: 500 } },
        { name: '', settings: {} },
        { settings: {} },
      ],
    }))
    expect(n).toBe(1)
    expect(store.list()[0].settings.customW).toBe(500)
  })

  it('损坏的存档返回空列表而不是崩掉', () => {
    const storage = memory()
    storage.setItem('test.key', '{oops')
    const s = createPresetStore(storage, 'test.key')
    expect(s.list()).toEqual([])
  })
})
