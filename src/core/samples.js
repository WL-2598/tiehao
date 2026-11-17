/** 运行时生成示例图，避免任何外部资源（离线版也能用）。 */

function paintScene(ctx, w, h, scene, lang = 'zh') {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  for (const [pos, color] of scene.stops) grad.addColorStop(pos, color)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (const shape of scene.shapes) {
    ctx.save()
    if (shape.type === 'circle') {
      ctx.globalAlpha = shape.alpha ?? 1
      ctx.fillStyle = shape.color
      ctx.beginPath()
      ctx.arc(shape.x * w, shape.y * h, shape.r * Math.min(w, h), 0, Math.PI * 2)
      ctx.fill()
    } else if (shape.type === 'hill') {
      ctx.globalAlpha = shape.alpha ?? 1
      ctx.fillStyle = shape.color
      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(shape.x * w, shape.y * h)
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fill()
    } else if (shape.type === 'star') {
      ctx.globalAlpha = shape.alpha ?? 1
      ctx.fillStyle = shape.color
      ctx.beginPath()
      ctx.arc(shape.x * w, shape.y * h, Math.max(1, shape.r * w), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const title = lang === 'en' ? (scene.titleEn || scene.title) : scene.title
  const subtitle = lang === 'en' ? (scene.subtitleEn || scene.subtitle) : scene.subtitle
  // 标题自动缩放，保证不会超出画布宽度
  let titleSize = Math.round(w * 0.16)
  ctx.font = `700 ${titleSize}px "Songti SC","STSong","Noto Serif SC","SimSun",serif`
  const maxWidth = w * 0.84
  const width = ctx.measureText(title).width
  if (width > maxWidth) {
    titleSize = Math.max(12, Math.floor((titleSize * maxWidth) / width))
    ctx.font = `700 ${titleSize}px "Songti SC","STSong","Noto Serif SC","SimSun",serif`
  }
  ctx.fillText(title, w / 2, h * 0.46)
  ctx.font = `400 ${Math.round(w * 0.035)}px "PingFang SC","Microsoft YaHei",sans-serif`
  ctx.globalAlpha = 0.85
  ctx.fillText(subtitle, w / 2, h * 0.56)
  ctx.globalAlpha = 1
}

const SCENES = [
  {
    name: '示例-落日.jpg',
    title: '落日',
    titleEn: 'Golden Hour',
    subtitle: 'TIEHAO SAMPLE',
    subtitleEn: 'TIEHAO SAMPLE · 01',
    stops: [[0, '#ffd9a0'], [0.55, '#ff9d6f'], [1, '#c8402a']],
    shapes: [
      { type: 'circle', x: 0.5, y: 0.34, r: 0.16, color: '#fff3d6', alpha: 0.95 },
      { type: 'hill', x: 0.25, y: 0.78, color: '#7a2a1c', alpha: 0.75 },
      { type: 'hill', x: 0.8, y: 0.82, color: '#5d1f14', alpha: 0.85 },
    ],
  },
  {
    name: '示例-青绿.jpg',
    title: '青绿',
    titleEn: 'Pine Green',
    subtitle: 'TIEHAO SAMPLE',
    subtitleEn: 'TIEHAO SAMPLE · 02',
    stops: [[0, '#e8f3ec'], [0.6, '#9fc9b4'], [1, '#2f5d50']],
    shapes: [
      { type: 'hill', x: 0.2, y: 0.72, color: '#3d6f5c', alpha: 0.85 },
      { type: 'hill', x: 0.75, y: 0.66, color: '#24473c', alpha: 0.9 },
      { type: 'circle', x: 0.68, y: 0.3, r: 0.09, color: '#f4e3c0', alpha: 0.9 },
    ],
  },
  {
    name: '示例-夜航.jpg',
    title: '夜航',
    titleEn: 'Night Flight',
    subtitle: 'TIEHAO SAMPLE',
    subtitleEn: 'TIEHAO SAMPLE · 03',
    stops: [[0, '#1b2340'], [0.6, '#3a3f6b'], [1, '#8a5a83']],
    shapes: [
      { type: 'circle', x: 0.72, y: 0.26, r: 0.11, color: '#f6ecd2', alpha: 0.95 },
      { type: 'star', x: 0.2, y: 0.2, r: 0.004, color: '#ffffff' },
      { type: 'star', x: 0.4, y: 0.32, r: 0.003, color: '#ffffff', alpha: 0.8 },
      { type: 'star', x: 0.55, y: 0.14, r: 0.003, color: '#ffffff', alpha: 0.7 },
      { type: 'star', x: 0.85, y: 0.45, r: 0.0025, color: '#ffffff', alpha: 0.7 },
      { type: 'hill', x: 0.5, y: 0.85, color: '#141a30', alpha: 0.9 },
    ],
  },
]

/** 生成一张示例图的 JPEG 字节（供预览、测试与文档复用）。 */
export async function makeSampleSource(index = 0, { lang = 'zh' } = {}) {
  const scene = SCENES[index % SCENES.length]
  const w = 1600
  const h = 2000
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  paintScene(canvas.getContext('2d'), w, h, scene, lang)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('示例图生成失败'))), 'image/jpeg', 0.88)
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/** 生成 3 张示例图（File 对象）。 */
export async function makeSampleFiles() {
  const files = []
  for (let i = 0; i < SCENES.length; i += 1) {
    const bytes = await makeSampleSource(i)
    files.push(new File([bytes], SCENES[i].name, { type: 'image/jpeg' }))
  }
  return files
}

export { SCENES }
