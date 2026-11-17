/**
 * 详情页切片。
 *
 * 电商详情页的真实约束：宽度固定 750，单张高度不能超过 1500（京东/淘宝/拼多多一致），
 * 一张 750×6000 的长图要切成 4 张上传。
 *
 * 关键在于「不要切在文字中间」：等分切片经常把一行字劈成两半，
 * 所以这里在理想切点附近找一行「最平静」的像素（行间差异最小）作为切口。
 */

/**
 * 每行的边缘能量：相邻行同一列像素的亮度差之和，越小越可能是纯色/留白区。
 * 只抽样约 96 列，并且用 32 位整数游标整行走——直接对千万级
 * Uint8ClampedArray 做逐像素属性访问会把主线程卡死。
 */
export function rowEnergy(data, width, height) {
  const energy = new Float64Array(height)
  const step = Math.max(1, Math.floor(width / 96))
  const stride = step * 4
  const rowStride = width * 4
  for (let y = 1; y < height; y += 1) {
    let sum = 0
    let a = (y - 1) * rowStride
    let b = y * rowStride
    const end = b + rowStride
    while (b < end) {
      const la = data[a] * 0.299 + data[a + 1] * 0.587 + data[a + 2] * 0.114
      const lb = data[b] * 0.299 + data[b + 1] * 0.587 + data[b + 2] * 0.114
      sum += la > lb ? la - lb : lb - la
      a += stride
      b += stride
    }
    energy[y] = sum
  }
  return energy
}

/**
 * 计算切割点（返回累计的 y 边界数组，长度 = 片数 + 1）。
 * 每个切点在理想位置附近寻找最小能量行，但必须满足：
 * 片高 ≤ maxHeight，且剩下的高度还装得下剩余片数——否则会出现
 * 「切口避让把某一片撑到超限」的反效果。
 */
export function planSlices(height, maxHeight, { energy = null, tolerance = 0 } = {}) {
  const H = Math.max(1, Math.round(height))
  const max = Math.max(1, Math.round(maxHeight))
  if (H <= max) return [0, H]

  const count = Math.ceil(H / max)
  const ideal = H / count
  const tol = Math.max(0, Math.min(Math.round(tolerance), Math.floor(ideal * 0.2)))
  const bounds = [0]

  for (let k = 1; k < count; k += 1) {
    const prev = bounds[bounds.length - 1]
    const remainingPieces = count - k          // 这一刀之后还要切几片
    const target = Math.round(k * ideal)

    // 硬约束：本片不能超长，剩余高度也必须装得进剩余片数
    const lo = Math.max(prev + 1, target - tol, H - remainingPieces * max)
    const hi = Math.min(target + tol, prev + max, H - remainingPieces)

    let best = Math.min(Math.max(target, lo), hi)
    if (energy && hi > lo) {
      let bestScore = Infinity
      for (let y = lo; y <= hi; y += 1) {
        if (energy[y] < bestScore) {
          bestScore = energy[y]
          best = y
        }
      }
    }
    bounds.push(best)
  }
  bounds.push(H)
  return bounds
}

/**
 * 把画布纵向切成若干片，每片高度 ≤ maxHeight。
 * 返回 [{ canvas, y, h, index, total }]，index 从 0 开始。
 */
export function sliceCanvas(canvas, maxHeight, opts = {}) {
  const w = canvas.width
  const h = canvas.height
  if (!maxHeight || h <= maxHeight) {
    return [{ canvas, y: 0, h, index: 0, total: 1 }]
  }

  let energy = null
  if (opts.avoidCutting !== false) {
    try {
      const ctx = canvas.getContext('2d')
      const data = ctx.getImageData(0, 0, w, h).data
      energy = rowEnergy(data, w, h)
    } catch {
      energy = null
    }
  }
  const bounds = planSlices(h, maxHeight, {
    energy,
    tolerance: opts.tolerance ?? Math.round(maxHeight * 0.12),
  })

  const out = []
  const total = bounds.length - 1
  for (let i = 0; i < total; i += 1) {
    const y = bounds[i]
    const sh = bounds[i + 1] - y
    if (sh <= 0) continue
    const piece = document.createElement('canvas')
    piece.width = w
    piece.height = sh
    const pctx = piece.getContext('2d')
    // 测试/预览环境里 canvas 可能是带 __native 的代理，原生 drawImage 不认代理对象
    pctx.drawImage(canvas.__native || canvas, 0, y, w, sh, 0, 0, w, sh)
    out.push({ canvas: piece, y, h: sh, index: i, total })
  }
  return out
}

/** 是否存在需要切片的目标。 */
export function hasSliceTarget(targets) {
  return targets.some((t) => t?.slice)
}
