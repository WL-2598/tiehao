// @vitest-environment happy-dom
/**
 * 运行时冒烟测试：把构建产物里的脚本跑在 happy-dom 里，
 * 验证 init() 不抛错、图标注入、设置联动、队列、品牌预设与本地存档。
 * canvas / createImageBitmap 用桩替代（真实像素渲染由 e2e 覆盖）。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const bodyHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]

function stubCanvas() {
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'measureText') return () => ({ width: 120 })
        if (key === 'createLinearGradient') return () => ({ addColorStop: () => {} })
        if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
        return () => {}
      },
      set: () => true,
    },
  )
  HTMLCanvasElement.prototype.getContext = () => ctx
  HTMLCanvasElement.prototype.toBlob = function (cb, type = 'image/png') {
    setTimeout(() => cb(new Blob([new Uint8Array(4096)], { type })), 0)
  }
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AAAA'
}

function runPage() {
  document.body.innerHTML = bodyHTML
  for (const code of scripts) {
    // eslint-disable-next-line no-new-func
    new Function(code).call(window)
  }
}

const change = (el) => el.dispatchEvent(new window.Event('change', { bubbles: true }))
const input = (el) => el.dispatchEvent(new window.Event('input', { bubbles: true }))
const saved = () => JSON.parse(localStorage.getItem('tiehao.settings.v1'))

describe('页面运行时冒烟', () => {
  beforeAll(() => {
    stubCanvas()
    // happy-dom 的 <img> 不会真的解码；用空实现避免异步噪声
    window.createImageBitmap = async () => ({ width: 1600, height: 2000, close() {} })
    globalThis.createImageBitmap = window.createImageBitmap
  })

  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('脚本无异常执行，图标、版本与价格注入完成', () => {
    expect(() => runPage()).not.toThrow()

    // 所有 data-icon 占位都被替换成内联 SVG
    expect(document.querySelectorAll('[data-icon]')).toHaveLength(0)
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(20)

    expect(document.querySelector('[data-edition-label]').textContent).toBe('在线体验版')
    expect(document.querySelector('#editionBadge').textContent).toBe('体验版')
    expect(document.querySelector('[data-version]').textContent).toBe('1.0.0')
    expect(document.querySelector('[data-max-files]').textContent).toBe('3')
    expect(document.querySelector('[data-max-files-offline]').textContent).toBe('30')
    expect(document.querySelector('[data-max-file-mb]').textContent).toBe('20')
    expect(document.querySelector('[data-price]').textContent).toBe('29')
  })

  it('切换画布预设会启用自定义尺寸并持久化', () => {
    runPage()
    const preset = document.querySelector('#preset')
    expect(document.querySelector('#customW').disabled).toBe(true)

    preset.value = 'custom'
    change(preset)

    expect(document.querySelector('#customW').disabled).toBe(false)
    expect(document.querySelector('#customH').disabled).toBe(false)
    expect(saved().preset).toBe('custom')

    preset.value = 'portrait34'
    change(preset)
    expect(document.querySelector('#customW').disabled).toBe(true)
  })

  it('适配方式分段按钮互斥并写入存档', () => {
    runPage()
    const coverBtn = document.querySelector('[data-fit="cover"]')
    coverBtn.click()
    expect(coverBtn.classList.contains('active')).toBe(true)
    expect(document.querySelector('[data-fit="contain"]').classList.contains('active')).toBe(false)
    expect(saved().fit).toBe('cover')
    // 铺满裁切时留白底色不可用
    expect(document.querySelector('#bgColor').disabled).toBe(true)
  })

  it('水印开关与平铺选项会联动控件状态', () => {
    runPage()
    const toggle = document.querySelector('#wmEnable')
    toggle.checked = false
    change(toggle)

    expect(saved().wm.enabled).toBe(false)
    expect(document.querySelector('#wmFields').classList.contains('is-disabled')).toBe(true)
    expect(document.querySelector('#stage').dataset.wm).toBe('off')

    toggle.checked = true
    change(toggle)
    const tiled = document.querySelector('#wmTiled')
    tiled.checked = true
    change(tiled)
    expect(document.querySelector('#wmPosGrid').classList.contains('is-disabled')).toBe(true)
    expect(document.querySelector('#wmPosLabel').textContent).toContain('平铺')
  })

  it('PNG 输出会禁用质量与目标体积控件', () => {
    runPage()
    const format = document.querySelector('#format')
    format.value = 'image/png'
    change(format)
    expect(document.querySelector('#quality').disabled).toBe(true)
    expect(document.querySelector('#targetKB').disabled).toBe(true)
    expect(document.querySelector('#targetHint').textContent).toContain('PNG')
  })

  it('空队列时按钮禁用，加载示例后队列与统计更新', async () => {
    runPage()
    expect(document.querySelector('#processBtn').disabled).toBe(true)
    expect(document.querySelector('#queueEmpty').hidden).toBe(false)

    document.querySelector('#loadSamples').click()

    await vi.waitFor(() => expect(document.querySelectorAll('#fileList .file-item').length).toBe(3), { timeout: 5000 })
    expect(document.querySelector('#queueCount').textContent).toBe('3')
    expect(document.querySelector('#processBtn').disabled).toBe(false)
    expect(document.querySelector('#queueEmpty').hidden).toBe(true)
    expect(document.querySelector('#queueTotalBefore').textContent).not.toBe('—')

    // 移除一张
    document.querySelector('#fileList .file-item .file-remove').click()
    expect(document.querySelectorAll('#fileList .file-item').length).toBe(2)
  })

  it('超出免费额度会提示并截断', async () => {
    runPage()
    document.querySelector('#loadSamples').click()
    await vi.waitFor(() => expect(document.querySelectorAll('#fileList .file-item').length).toBe(3))
    // 再点一次：3 + 3 > 3 上限，只应保留 3 张
    document.querySelector('#loadSamples').click()
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelectorAll('#fileList .file-item').length).toBe(3)
    expect(document.querySelector('#toast').textContent.length).toBeGreaterThan(0)
  })

  it('品牌预设可保存、载入、删除并出现在下拉框', async () => {
    runPage()
    const preset = document.querySelector('#preset')
    preset.value = 'square11'
    change(preset)

    document.querySelector('#brandName').value = '双十一主号'
    document.querySelector('#brandSave').click()

    const select = document.querySelector('#brandSelect')
    expect(select.options.length).toBe(2)
    expect(select.textContent).toContain('双十一主号')

    // 改成别的设置，再载入预设恢复
    preset.value = 'portrait34'
    change(preset)
    document.querySelector('#brandLoad').click()
    expect(document.querySelector('#preset').value).toBe('square11')

    window.confirm = () => true
    document.querySelector('#brandDelete').click()
    expect(document.querySelector('#brandSelect').options.length).toBe(1)
  })

  it('FAQ 折叠与购买弹窗可正常开关', () => {
    runPage()
    const faq = document.querySelector('#faq details')
    faq.querySelector('summary').click()
    expect(faq.hasAttribute('open')).toBe(false)

    document.querySelector('[data-buy]').click()
    const modal = document.querySelector('#buyModal')
    expect(modal.hidden).toBe(false)
    document.querySelector('#buyClose').click()
    expect(modal.hidden).toBe(true)

    document.querySelector('[data-buy]').click()
    expect(modal.hidden).toBe(false)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(modal.hidden).toBe(true)
  })
})
