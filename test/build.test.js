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
