/** 把离线版打包成 ZIP：product/TieHao-Offline-v{version}.zip */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const { config } = await import(path.join(ROOT, 'src', 'config.js'))

const htmlPath = path.join(ROOT, 'product', 'TieHao-Offline.html')
if (!fs.existsSync(htmlPath)) {
  console.error('先运行 node build.mjs 生成 product/TieHao-Offline.html')
  process.exit(1)
}

const zip = new JSZip()
const version = config.version
zip.file(`TieHao-Offline-v${version}.html`, fs.readFileSync(htmlPath))
zip.file('LICENSES.txt', `帖好 TieHao 离线批量版 v${version}

本产品代码：MIT 许可（见 GitHub 仓库 LICENSE）
打包组件：JSZip 3.10.2（MIT / GPLv3 双许可，本产品选择 MIT）

画布尺寸为常用工作画布，非平台官方强制规范。
图片在浏览器本地处理，不上传服务器。
`)
zip.file('使用说明.txt', `帖好 TieHao · 离线批量版 v${version}

1. 把 TieHao-Offline-v${version}.html 复制到任意位置（U 盘、桌面、网盘都行）。
2. 双击文件，用 Chrome / Edge / Firefox / Safari 打开。
3. 拖入原图 → 在「目标平台 · 一图多版」里勾选要投放的平台（最多 ${config.maxTargetsOffline} 个）→
   按需设置文案排版 / 品牌 Logo / 白边裁剪 / 目标体积 → 开始处理 → 下载 ZIP。
4. 可以完全断网使用；图片不会离开你的电脑。

ZIP 内按平台分目录，manifest.csv 记录 原文件 / 平台 / 规格 / 体积变化 / 是否达标。
文件名模板可用 {name} {platform} {w} {h} {index} {ext}；留空则保留原文件名。

每批最多 ${config.offlineMaxFiles} 张，单张 ≤ ${config.maxFileMB}MB。
品牌预设在本机浏览器里保存，可用 JSON 导出备份。
`)

const out = path.join(ROOT, 'product', `TieHao-Offline-v${version}.zip`)
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.writeFileSync(out, buf)
console.log(`✓ ${path.relative(ROOT, out)}  ${(buf.length / 1024).toFixed(0)} KB`)
