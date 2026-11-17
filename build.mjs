/**
 * 构建脚本：
 *   node build.mjs          构建在线版与离线版（默认压缩）
 *   node build.mjs --dev    不压缩 + 启动本地预览服务
 *   node build.mjs --serve 压缩 + 启动本地预览服务
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(ROOT, 'src')
const PUBLIC_DIR = path.join(ROOT, 'public')
const PRODUCT_DIR = path.join(ROOT, 'product')

const args = new Set(process.argv.slice(2))
const DEV = args.has('--dev')
const SERVE = DEV || args.has('--serve')
const PORT = Number(process.env.PORT || 4173)

const { config } = await import(path.join(SRC, 'config.js'))

function ensureDirs() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  fs.mkdirSync(PRODUCT_DIR, { recursive: true })
}

async function bundleApp() {
  const result = await build({
    entryPoints: [path.join(SRC, 'app/main.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    minify: !DEV,
    legalComments: 'inline',
    sourcemap: DEV ? 'inline' : false,
    write: false,
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': JSON.stringify(DEV ? 'development' : 'production'),
    },
  })
  return result.outputFiles[0].text
}

function readLicenses() {
  const parts = []
  const jszipLicense = path.join(ROOT, 'node_modules', 'jszip', 'LICENSE.markdown')
  if (fs.existsSync(jszipLicense)) {
    parts.push('JSZip 3.10.2（MIT 或 GPLv3 双许可，本产品选择 MIT）\n\n' + fs.readFileSync(jszipLicense, 'utf8'))
  }
  parts.push(
    '本产品（帖好 TieHao）代码为 MIT 许可，见仓库 LICENSE 文件。\n\n' +
      '画布尺寸为常用工作画布，非平台官方强制规范。图片在浏览器本地处理。',
  )
  return parts.join('\n\n' + '-'.repeat(60) + '\n\n')
}

function escapeScript(text) {
  return text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
}

async function main() {
  ensureDirs()
  const [{ renderTemplate }, cssOut, app] = await Promise.all([
    import(path.join(SRC, 'site/template.js')),
    build({
      entryPoints: [path.join(SRC, 'styles/main.css')],
      bundle: true,
      minify: !DEV,
      write: false,
      logLevel: 'warning',
    }),
    bundleApp(),
  ])
  const css = cssOut.outputFiles[0].text
  const licenses = readLicenses()
  const template = renderTemplate()

  const editions = [
    { edition: 'web', out: path.join(PUBLIC_DIR, 'index.html') },
    { edition: 'offline', out: path.join(PRODUCT_DIR, 'TieHao-Offline.html') },
  ]

  for (const { edition, out } of editions) {
    const configJSON = escapeScript(JSON.stringify({ ...config, edition }))
    const html = template
      .replace('{{CSS}}', () => css)
      .replace('{{CONFIG}}', () => configJSON)
      .replace('{{APP}}', () => escapeScript(app))
      .replace('{{LICENSES}}', () => licenses.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    fs.writeFileSync(out, html)
    console.log(`✓ ${path.relative(ROOT, out)}  ${(html.length / 1024).toFixed(0)} KB`)
  }

  // 根目录 index.html 与在线版保持一致，兼容从仓库根目录部署的场景
  fs.copyFileSync(path.join(PUBLIC_DIR, 'index.html'), path.join(ROOT, 'index.html'))
  console.log('✓ index.html（在线版镜像）')

  if (SERVE) startServer()
}

function startServer() {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath)
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden')
      return
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404')
      return
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': DEV ? 'no-store' : 'public, max-age=3600',
    })
    fs.createReadStream(file).pipe(res)
  })
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n帖好 TieHao 预览：http://localhost:${PORT}/`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
