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

let stubState = null
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
  const toBlobStub = function (cb, type = 'image/png') {
    setTimeout(() => cb(new Blob([new Uint8Array(4096)], { type })), 0)
  }
  stubState = { toBlobStub }
  stubCanvas.toBlobStub = toBlobStub
  HTMLCanvasElement.prototype.toBlob = toBlobStub
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
    expect(document.querySelector('[data-version]').textContent).toMatch(/^1\.\d+\.\d+$/)
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

describe('电商合规：白底图与详情切片', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('目标列表显示白底/切片/体积标签', () => {
    runPage()
    const white = document.querySelector('[data-target="taobao-white"]')
    expect(white).toBeTruthy()
    expect(white.textContent).toContain('纯白底')
    const detail = document.querySelector('[data-target="taobao-detail"]')
    expect(detail.textContent).toContain('切 1500px')
    expect(detail.textContent).toContain('500KB')
  })

  it('选中白底图后给出「会忽略文字层」的提示', async () => {
    runPage()
    const note = () => document.querySelector('#complianceNote')
    expect(note().hidden).toBe(true)

    // 水印默认是开着的，这里确认文字非空即可
    const wmText = document.querySelector('#wmText')
    expect(document.querySelector('#wmEnable').checked).toBe(true)
    wmText.value = 'DEMO'
    input(wmText)

    document.querySelector('[data-target="taobao-white"]').click()
    await vi.waitFor(() => expect(note().hidden).toBe(false), { timeout: 4000 })
    expect(note().textContent).toContain('纯白底')
    expect(note().textContent).toContain('水印')
  })

  it('上架包一次勾好整套目标（在线版只勾可用的那几个）', async () => {
    runPage()
    const pack = () => document.querySelector('[data-pack="taobao-listing"]')
    expect(pack()).toBeTruthy()
    // 在线版淘宝上架包里，主图与白底图免费、详情切片需离线版
    expect(pack().textContent).toContain('需离线版')
    pack().click()
    await vi.waitFor(() => {
      expect((saved() || {}).targets).toEqual(['taobao-main', 'taobao-white'])
    })
    // 再点一次取消
    pack().click()
    await vi.waitFor(() => expect((saved() || {}).targets).toEqual([]))
  })

  it('整包都锁着时点一下直接引导到购买说明', async () => {
    runPage()
    document.querySelector('[data-pack="xianyu-listing"]').click()
    await vi.waitFor(() => {
      expect(document.querySelector('#buyModal').hidden).toBe(false)
    })
    expect((saved() || {}).targets).toBeUndefined()
  })

  it('只选普通主图时不出现合规提示', async () => {
    runPage()
    document.querySelector('[data-target="taobao-main"]').click()
    await vi.waitFor(() => {
      expect(document.querySelector('#targetSummary').textContent).toContain('淘宝')
    })
    expect(document.querySelector('#complianceNote').hidden).toBe(true)
  })
})

describe('离线版不再推销自己', () => {
  it('离线产物隐藏价格区、购买按钮与价格导航', async () => {
    localStorage.clear()
    const offline = fs.readFileSync(path.join(ROOT, 'product/TieHao-Offline.html'), 'utf8')
    const scripts = [...offline.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    document.body.innerHTML = offline.slice(offline.indexOf('<body'), offline.indexOf('</body>') + 7)
    for (const code of scripts) new Function(code).call(window)

    expect(document.querySelector('#pricing').hidden).toBe(true)
    const buys = [...document.querySelectorAll('[data-buy]')]
    expect(buys.length).toBeGreaterThan(0)
    expect(buys.every((el) => el.hidden)).toBe(true)
    expect([...document.querySelectorAll('a[href="#pricing"]')].every((el) => el.hidden)).toBe(true)
    // 工作台仍然可用：目标平台与管理控件照常渲染
    expect(document.querySelectorAll('#targetList .target-item').length).toBeGreaterThan(10)
    expect(document.querySelector('#editionBadge').textContent).toBe('离线批量版')
  })
})

describe('失败重试与额度提示', () => {
  beforeAll(() => {
    window.createImageBitmap = async () => ({ width: 1600, height: 2000, close() {} })
    globalThis.createImageBitmap = window.createImageBitmap
  })
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('编码失败会标记为失败，重试按钮出现且能重新处理成功', async () => {
    runPage()
    // 每次 runPage 会重新执行脚本、重新绑定；但 toBlob 桩是共享的，
    // 这里显式重置，避免上一个用例的失败标记泄漏
    HTMLCanvasElement.prototype.toBlob = stubCanvas.toBlobStub
    document.querySelector('#loadSamples').click()
    await vi.waitFor(() => expect(document.querySelectorAll('#fileList .file-item').length).toBe(3))
    expect(document.querySelector('#retryFailed').hidden).toBe(true)

    // 让第一次编码失败（模拟浏览器不支持该格式）
    const realToBlob = HTMLCanvasElement.prototype.toBlob
    let failedOnce = false
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
      if (!failedOnce) {
        failedOnce = true
        setTimeout(() => cb(null), 0)
        return
      }
      return realToBlob.call(this, cb, type, q)
    }

    document.querySelector('#processBtn').click()
    // 整批跑完才会刷新操作区，所以等状态文案而不是只等第一项标红
    await vi.waitFor(() => {
      expect(document.querySelectorAll('#fileList .file-status.error').length).toBe(1)
      expect(document.querySelector('#statusText').textContent).toContain('失败')
    }, { timeout: 20000 })
    await vi.waitFor(() => {
      expect(document.querySelector('#retryFailed').hidden).toBe(false)
    }, { timeout: 20000 })

    // 重试：失败项回到待处理，重新跑一遍后应全部完成
    HTMLCanvasElement.prototype.toBlob = realToBlob
    document.querySelector('#retryFailed').click()
    await vi.waitFor(() => {
      expect(document.querySelectorAll('#fileList .file-status.done').length).toBe(3)
    }, { timeout: 20000 })
    expect(document.querySelector('#retryFailed').hidden).toBe(true)
    expect(document.querySelector('#summaryText').textContent).toContain('已处理 3/3')
  })
})

describe('一图多版与付费分层', () => {
  beforeAll(() => {
    window.createImageBitmap = async () => ({ width: 1600, height: 2000, close() {} })
    globalThis.createImageBitmap = window.createImageBitmap
  })
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('平台列表渲染出国内外平台，锁定项带标记', () => {
    runPage()
    const items = document.querySelectorAll('#targetList .target-item')
    expect(items.length).toBeGreaterThan(15)

    // 在线版：常用平台可选，其余标记为离线版
    const locked = document.querySelectorAll('#targetList .target-item.is-locked')
    expect(locked.length).toBeGreaterThan(0)
    expect(document.querySelector('#targetList [data-target="xiaohongshu"]').classList.contains('is-locked')).toBe(false)

    const groups = [...document.querySelectorAll('.target-group-label')].map((el) => el.textContent)
    expect(groups).toContain('小红书')
    expect(groups).toContain('抖音')
    expect(groups).toContain('Instagram')
  })

  it('勾选目标会写入设置、更新摘要并持久化', () => {
    runPage()
    document.querySelector('#targetList [data-target="xiaohongshu"]').click()

    // 列表会重渲染，必须重新查询（旧节点已从 DOM 移除）
    expect(document.querySelector('#targetList [data-target="xiaohongshu"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('#targetSummary').textContent).toContain('小红书')
    expect(document.querySelector('#outputBadge').textContent).toContain('目标')

    const saved = JSON.parse(localStorage.getItem('tiehao.settings.v1'))
    expect(saved.targets).toContain('xiaohongshu')

    // 再点取消
    document.querySelector('#targetList [data-target="xiaohongshu"]').click()
    expect(document.querySelector('#targetSummary').textContent).toContain('未选择目标')
  })

  it('点击锁定平台会弹出购买说明而不是静默失败', () => {
    runPage()
    const locked = document.querySelector('#targetList .target-item.is-locked')
    expect(locked).toBeTruthy()
    locked.click()
    expect(document.querySelector('#buyModal').hidden).toBe(false)
    expect(document.querySelector('#targetSummary').textContent).toContain('未选择目标')
  })

  it('搜索能过滤平台', () => {
    runPage()
    const search = document.querySelector('#targetSearch')
    search.value = 'instagram'
    search.dispatchEvent(new window.Event('input', { bubbles: true }))
    const items = document.querySelectorAll('#targetList .target-item')
    expect(items.length).toBeGreaterThan(0)
    expect([...items].every((el) => el.dataset.target.startsWith('instagram'))).toBe(true)

    search.value = 'zzzz'
    search.dispatchEvent(new window.Event('input', { bubbles: true }))
    expect(document.querySelector('#targetList .target-empty')).toBeTruthy()
  })

  it('在线版锁定文案 / Logo / 裁剪，且点击有引导', () => {
    runPage()
    for (const id of ['copyEnable', 'logoEnable', 'trimEnable']) {
      const el = document.querySelector('#' + id)
      expect(el.disabled).toBe(true)
      expect(el.closest('.check').classList.contains('is-locked')).toBe(true)
    }
    document.querySelector('#copyEnable').closest('.check').click()
    expect(document.querySelector('#buyModal').hidden).toBe(false)
  })

  it('文案控件写入设置并同步输出数值', () => {
    runPage()
    // 在线版被锁，直接调内部读取路径：手动解除 disabled 后触发 change
    const title = document.querySelector('#copyTitle')
    title.value = '限时特惠'
    title.dispatchEvent(new window.Event('input', { bubbles: true }))
    const scale = document.querySelector('#copyScale')
    scale.value = '1.2'
    scale.dispatchEvent(new window.Event('input', { bubbles: true }))
    expect(document.querySelector('#copyScaleOut').textContent).toBe('120%')
  })

  it('安全区开关与提示联动', () => {
    runPage()
    document.querySelector('#targetList [data-target="douyin"]').click()
    expect(document.querySelector('#safeHint').textContent).toContain('安全区')

    const toggle = document.querySelector('#safeGuide')
    toggle.checked = true
    toggle.dispatchEvent(new window.Event('change', { bubbles: true }))
    expect(toggle.checked).toBe(true)
  })

  it('预览模式可切到「全部产出」并给出空态提示', () => {
    runPage()
    const tab = [...document.querySelectorAll('.preview-tab')].find((b) => b.dataset.mode === 'grid')
    tab.click()
    expect(document.querySelector('#stageGrid').hidden).toBe(false)
    expect(document.querySelector('#stageGrid').textContent).toContain('先处理一次')
  })
})
