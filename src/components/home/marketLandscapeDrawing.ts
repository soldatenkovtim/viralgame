/** A continuous, abstract terrain — not market prices or a model of future returns. */
export const LANDSCAPE_PERIOD = 12_000
const TAU = Math.PI * 2
export type LandscapePoint = [number, number]
const levels = [
  [42, 62, 62, 88, 88, 70, 48, 38, 38],
  [42, 62, 104, 128, 128, 98, 70, 48, 38],
  [42, 70, 104, 128, 128, 98, 70, 48, 38],
  [38, 70, 104, 104, 82, 58, 58, 76, 54],
  [38, 58, 82, 82, 42, 28, 42, 76, 54],
  [32, 58, 58, 42, 28, 28, 42, 76, 54],
  [32, 42, 42, 42, 48, 64, 64, 64, 48],
  [28, 28, 42, 48, 64, 88, 88, 64, 48],
  [28, 28, 28, 48, 64, 64, 64, 48, 48],
]

export function projectLandscape(x: number, y: number, height = 0): LandscapePoint {
  return [310 + (x - y) * 28, 132 + (x + y) * 16 - height]
}

export function landscapeFrame(time: number) {
  const phase = ((time % LANDSCAPE_PERIOD) + LANDSCAPE_PERIOD) % LANDSCAPE_PERIOD / LANDSCAPE_PERIOD * TAU
  return levels.flatMap((row, y) => row.map((base, x) => {
    // Neighbouring terraces share a travelling wave, with a small second harmonic.
    const wave = phase - Math.hypot(x - 2, y - 1) * .48
    const height = base + 13 * Math.sin(wave) + 4 * Math.sin(phase * 2 - x * .3 - y * .4)
    const north = Math.exp(-((x - 3.5) ** 2 + (y - 1.5) ** 2) / 3.2)
    const south = Math.exp(-((x - 5.5) ** 2 + (y - 7) ** 2) / 3.5)
    const accent = Math.min(1, north * (.35 + .65 * ((1 + Math.cos(phase - .6)) / 2) ** 2)
      + south * (.35 + .65 * ((1 + Math.cos(phase - Math.PI - .6)) / 2) ** 2))
    return { x, y, height, accent, signal: ((1 + Math.cos(wave - 1.4)) / 2) ** 12 }
  }))
}

type RGB = [number, number, number]
function mix(a: RGB, b: RGB, amount: number) {
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`
}

export function drawMarketLandscape(ctx: CanvasRenderingContext2D, time: number, dark: boolean) {
  time = ((time % LANDSCAPE_PERIOD) + LANDSCAPE_PERIOD) % LANDSCAPE_PERIOD
  ctx.clearRect(0, 0, 620, 540)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1
  const cells = landscapeFrame(time)
  const grid = dark ? '#77727f' : '#9c95a8'
  const outline = dark ? '#c7c1d5' : '#71677e'
  const lime = dark ? '#d4f566' : '#849d32'
  const top: RGB = dark ? [92, 91, 104] : [107, 106, 118]
  const left: RGB = dark ? [52, 51, 62] : [66, 63, 78]
  const right: RGB = dark ? [35, 34, 43] : [43, 41, 53]
  const purpleTop: RGB = [179, 147, 238]
  const purpleLeft: RGB = [136, 83, 217]
  const purpleRight: RGB = [105, 56, 179]

  function line(points: LandscapePoint[], color: string, width = .65, opacity = 1) {
    ctx.beginPath()
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = opacity; ctx.stroke()
    ctx.globalAlpha = 1
  }
  function face(points: LandscapePoint[], fill: string, stroke = outline, opacity = .32) {
    ctx.beginPath()
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.fillStyle = fill; ctx.fill()
    ctx.strokeStyle = stroke; ctx.lineWidth = .6; ctx.globalAlpha = opacity; ctx.stroke()
    ctx.globalAlpha = 1
  }
  const p = projectLandscape

  // A ground plane, not a rectangular backdrop. The ends gently disappear.
  for (let step = -1; step <= 10; step++) {
    const opacity = .09 + .08 * Math.sin((step + 1) / 11 * Math.PI)
    line([p(step, -1, -22), p(step, 10, -22)], grid, .6, opacity)
    line([p(-1, step, -22), p(10, step, -22)], grid, .6, opacity)
  }
  ctx.setLineDash([2, 6])
  line([p(-.65, 9.65, -22), p(9.65, 9.65, -22), p(9.65, -.65, -22)], grid, .7, .55)
  line([p(0, 0, 90), p(0, 0, -22)], grid, .7, .3)
  ctx.setLineDash([])

  // One continuous foundation unites the entire structure.
  face([p(-.15, -.15), p(9.15, -.15), p(9.15, 9.15), p(-.15, 9.15)], dark ? '#3d3a46' : '#55515f')
  face([p(-.15, 9.15), p(9.15, 9.15), p(9.15, 9.15, -16), p(-.15, 9.15, -16)], dark ? '#292730' : '#373340')
  face([p(9.15, -.15), p(9.15, 9.15), p(9.15, 9.15, -16), p(9.15, -.15, -16)], dark ? '#201e27' : '#2c2836')
  line([p(-.15, 9.15, -7), p(9.15, 9.15, -7), p(9.15, -.15, -7)], outline, .6, .16)

  // Painter order and shared coordinates keep the terraces watertight. Only
  // exposed height differences get walls; no separated, floating cube modules.
  for (const cell of [...cells].sort((a, b) => a.x + a.y - b.x - b.y)) {
    const { x, y, height: h, accent } = cell
    const front = y === 8 ? 0 : cells[(y + 1) * 9 + x].height
    const side = x === 8 ? 0 : cells[y * 9 + x + 1].height
    if (h > front) {
      face([p(x, y + 1, h), p(x + 1, y + 1, h), p(x + 1, y + 1, front), p(x, y + 1, front)], mix(left, purpleLeft, accent * .8))
      for (let z = Math.ceil(front / 10) * 10; z < h - 2; z += 10) {
        line([p(x, y + 1, z), p(x + 1, y + 1, z)], outline, .45, .09)
      }
    }
    if (h > side) {
      face([p(x + 1, y, h), p(x + 1, y + 1, h), p(x + 1, y + 1, side), p(x + 1, y, side)], mix(right, purpleRight, accent * .8))
      for (let z = Math.ceil(side / 10) * 10; z < h - 2; z += 10) {
        line([p(x + 1, y, z), p(x + 1, y + 1, z)], outline, .45, .1)
      }
    }
    const elevation = Math.max(0, Math.min(1, (h - 15) / 140))
    const stone = top.map(value => value - 12 + elevation * 22) as RGB
    face([p(x, y, h), p(x + 1, y, h), p(x + 1, y + 1, h), p(x, y + 1, h)], mix(stone, purpleTop, accent), outline, .38)

    // Sparse traces move along real surface edges, following the same wave.
    if ((y === 2 && x >= 2 && x <= 5) || (x === 6 && y >= 5 && y <= 7)) {
      const progress = ((time / LANDSCAPE_PERIOD * 2 + (x + y) * .11) % 1 + 1) % 1
      const alpha = Math.sin(progress * Math.PI) ** 2 * cell.signal
      line([p(x + progress * .7, y + 1, h + .5), p(x + progress * .7 + .3, y + 1, h + .5)], lime, 1.8, alpha)
      line([p(x, y, h + .3), p(x, y + 1, h + .3)], lime, .8, cell.signal * .5)
    }
  }
}
