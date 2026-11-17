import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const webPath = path.join(ROOT, 'public', 'index.html')
const offlinePath = path.join(ROOT, 'product', 'TieHao-Offline.html')

const web = fs.existsSync(webPath) ? fs.readFileSync(webPath, 'utf8') : ''
const offline = fs.existsSync(offlinePath) ? fs.readFileSync(offlinePath, 'utf8') : ''

describe('构建产物', () => {
  it('两个版本都已生成', () => {
    expect(web.length).toBeGreaterThan(10_000)
    expect(offline.length).toBeGreaterThan(10_000)
  })

  it('模板占位符全部被替换', () => {
    for (const html of [web, offline]) {
      expect(html).not.toContain('{{CSS}}')
      expect(html).not.toContain('{{APP}}')
      expect(html).not.toContain('{{CONFIG}}')
      expect(html).not.toContain('{{LICENSES}}')
      expect(html).not.toContain('{{VERSION}}')
    }
  })

  it('注入的 edition 与单文件自包含', () => {
    expect(web).toContain('"edition":"web"')
    expect(offline).toContain('"edition":"offline"')
    // 离线版不能引用任何外部脚本 / 样式 / 字体
    const externalRefs = offline.match(/<(script|link)[^>]+(src|href)="https?:/gi) || []
    expect(externalRefs).toEqual([])
  })

  it('包含许可证与关键结构', () => {
    expect(offline).toContain('JSZip')
    expect(offline).toContain('manifest.csv')
    expect(web).toContain('出图工作台')
    expect(web).toContain('id="dropzone"')
    expect(web).toContain('id="fileInput"')
  })
})

describe('样式与结构细节', () => {
  it('[hidden] 具备全局优先级，避免被 .btn 等 display 规则覆盖', () => {
    expect(web).toContain('[hidden]{display:none!important}')
    expect(web).toContain('id="retryFailed"')
    expect(web).toContain('id="loadSamples"')
  })

  it('无障碍：主区域、语言、状态播报齐备', () => {
    expect(web).toContain('lang="zh-CN"')
    expect(web).toContain('aria-live')
    expect(web).toContain('role="button"')
    expect(web).toContain('prefers-reduced-motion')
  })

  it('隐私承诺：页面不含任何外部资源引用', () => {
    expect(web.match(/<(script|link|img|source)[^>]+(src|href)="https?:/gi) || []).toEqual([])
  })
})
