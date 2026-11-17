/** 静态检查：JS 里引用的 DOM id 是否都存在于模板 / 构建产物中。 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8')
const appSrc = ['src/app/main.js', 'src/app/ui.js']
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n')

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
const refs = new Set(
  [...appSrc.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]),
)
// 动态生成的 id（模板里没有、运行时创建）白名单
const dynamic = new Set(['toast'])

const missing = [...refs].filter((id) => !htmlIds.has(id) && !dynamic.has(id))
if (missing.length) {
  console.error('模板缺少以下 id：', missing.join(', '))
  process.exit(1)
}
console.log(`✓ ${refs.size} 个 id 引用全部存在`)

// 反向检查：模板里被 JS 使用的 data-* 钩子（JS 里可能写作 dataset.x）
for (const attr of ['data-fit', 'data-pos', 'data-mode', 'data-buy', 'data-icon', 'data-edition-label', 'data-max-files', 'data-price', 'data-version', 'data-count']) {
  const name = attr.slice(5)
  const inHtml = html.includes(attr)
  const inJs = appSrc.includes(attr) || appSrc.includes(`dataset.${name}`)
  if (!inHtml) console.warn(`⚠ 模板中没有 ${attr}`)
  if (inHtml && !inJs) console.warn(`⚠ JS 中没有使用 ${attr}`)
}
console.log('✓ data-* 钩子检查完成')
