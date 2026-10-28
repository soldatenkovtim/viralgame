import { useEffect, useRef } from 'react'
import { useTheme } from '@/lib/theme'
import styles from './HeroVisual.module.css'
import { PERIOD, TAU, decision, pointOn, outcomeRoutes, routeAt, sequenceAt, type Point, type Curve } from './marketSimulationMotion'

const sources: Point[] = [[70, 150], [70, 272], [70, 394]]
const inputLabels = ['ПОТОК', 'ЛИКВИДНОСТЬ', 'ВОЛАТИЛЬНОСТЬ']
const outcomeLabels = ['ИМПУЛЬС', 'РАВНОВЕСИЕ', 'СМЕНА РЕЖИМА']

/** A scenario map, not forecasts or live market data. Every moving parameter closes at 12s. */
function draw(ctx: CanvasRenderingContext2D, time: number, dark: boolean, compact: boolean, focus = [0, 0, 0], reduced = false) {
  const turn = (time % PERIOD) / PERIOD
  const phase = turn * TAU
  const sequence = sequenceAt(reduced ? 2400 : time)
  const focused = Math.min(1, focus.reduce((sum, value) => sum + value, 0))
  const ink = dark ? '#141416' : '#f5f5f1'
  const line = dark ? '#48444f' : '#c8c2d1'
  const muted = dark ? '#a09aa9' : '#72677d'
  const white = dark ? '#e6e2eb' : '#38313f'
  const purple = dark ? '#b397e4' : '#8151b6'
  const lime = dark ? '#d4f566' : '#667f18'
  ctx.clearRect(0, 0, 620, 540)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  function path(points: Point[], color: string | CanvasGradient, width = 1) {
    ctx.beginPath()
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
  }
  function curve(points: Curve, color: string | CanvasGradient, width = 1) {
    ctx.beginPath(); ctx.moveTo(...points[0]); ctx.bezierCurveTo(...points[1], ...points[2], ...points[3])
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
  }
  function circle([x, y]: Point, radius: number, color: string, fill?: string) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU)
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke()
  }
  function text(value: string, x: number, y: number, color = muted) {
    ctx.font = `${compact ? 20 : 12}px monospace`
    ctx.fillStyle = color
    ctx.fillText(value, x, y)
  }
  function pulse(points: Curve, progress: number, color: string, opacity = 1) {
    // Fade before wrapping, so particles never jump visibly back to the source.
    ctx.globalAlpha = Math.sin(progress * Math.PI) ** 2 * opacity
    circle(pointOn(points, progress), 2.5, color, color)
    ctx.globalAlpha = 1
  }

  function fade(from: Point, to: Point, color: string, stops: [number, number][]) {
    const gradient = ctx.createLinearGradient(...from, ...to)
    for (const [offset, alpha] of stops) {
      gradient.addColorStop(offset, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`)
    }
    return gradient
  }
  function edgeOpacity(position: number, start: number, end: number, distance: number) {
    const t = Math.max(0, Math.min(1, (position - start) / distance, (end - position) / distance))
    return t * t * (3 - 2 * t)
  }

  // Feather only the background geometry; labels and decision routes stay crisp.
  const gridStops: [number, number][] = [[0, 0], [.18, 1], [.78, 1], [1, 0]]
  const verticalGrid = fade([0, 66], [0, 470], line, gridStops)
  const horizontalGrid = fade([28, 0], [604, 0], line, gridStops)
  for (let x = 40; x < 604; x += 24) {
    ctx.globalAlpha = .26 * edgeOpacity(x, 28, 604, 100)
    path([[x, 66], [x, 470]], verticalGrid, .55)
  }
  for (let y = 80; y <= 470; y += 24) {
    ctx.globalAlpha = .26 * edgeOpacity(y, 66, 470, 72)
    path([[28, y], [604, y]], horizontalGrid, .55)
  }
  ctx.globalAlpha = 1
  const alternatives = fade([440, 0], [604, 0], line, [[0, 1], [.35, .8], [1, 0]])

  // Three imperfect input traces, intentionally not exchange candles or price charts.
  for (let i = 0; i < sources.length; i++) {
    const [x, y] = sources[i]
    text(inputLabels[i], 28, y - 42)
    const trace: Point[] = Array.from({ length: 19 }, (_, j) => [28 + j * 4.6,
      y - 20 + Math.sin(j * 1.8 + phase + i) * (3 + Math.sin(phase + i) * 1.5)])
    path(trace, i === 1 ? white : purple, .9)
    const input: Curve = [[x, y], [151, y], [156, 272], decision]
    curve(input, line, 1)
    if (!reduced) pulse(input, sequence.incoming[i], i === 1 ? lime : purple, 1 - focused)
    circle([x, y], 3, muted, ink)
  }

  // A field of alternative futures stays visible even while one route is emphasized.
  const routes = outcomeRoutes(time)
  for (let branch = 0; branch < 3; branch++) {
    const weight = (sequence.branch === branch ? sequence.route : 0) * (1 - focused) + focus[branch]
    const opacity = 1 - (focused - focus[branch]) * .45
    const route = routes[branch]
    const end = route[3]
    // Soft outcome envelope: uncertainty widens farther away from the decision.
    ctx.beginPath(); ctx.moveTo(...decision)
    ctx.bezierCurveTo(330, 272, 368, end[1] - 32, 604, end[1] - 32)
    ctx.lineTo(604, end[1] + 32)
    ctx.bezierCurveTo(368, end[1] + 32, 330, 272, ...decision)
    ctx.closePath()
    ctx.globalAlpha = (.02 + weight * .025) * opacity
    ctx.fillStyle = fade(decision, [604, 272], branch === 0 ? lime : purple,
      [[0, 0], [.35, 1], [.65, .8], [1, 0]])
    ctx.fill()
    ctx.globalAlpha = 1
    for (const spread of compact ? [-18, 18] : [-26, -13, 13, 26]) {
      ctx.globalAlpha = .32 * opacity
      curve([decision, [330, 272 + spread * .2], [360, end[1] + spread], [604, end[1] + spread]], alternatives, .7)
    }
    ctx.globalAlpha = .55 * opacity
    curve(route, purple, 1)
    ctx.globalAlpha = weight
    curve(route, lime, 1.7)
    ctx.globalAlpha = opacity
    const junction = pointOn(route, .62)
    circle(junction, 5, purple, ink)
    ctx.globalAlpha = weight
    circle(junction, 5, lime, ink)
    circle(junction, 1.5, lime, lime)
    ctx.globalAlpha = opacity
    if (!reduced && sequence.branch === branch) pulse(route, sequence.outgoing, lime, sequence.route * (1 - focused))
    ctx.globalAlpha = opacity
    circle(end, 3, purple, ink)
    ctx.globalAlpha = weight
    circle(end, 3, lime)
    ctx.globalAlpha = opacity
    // Each label follows its own endpoint; these are schematic outcomes, not forecasts.
    const labelX = compact ? 372 : 418
    text(`0${branch + 1} /`, labelX, end[1] - 43, purple)
    text(outcomeLabels[branch], labelX + (compact ? 60 : 36), end[1] - 43, white)
    path([[labelX, end[1] - 31], [end[0], end[1] - 31], [end[0], end[1] - 9]], line, .65)
    ctx.globalAlpha = 1
  }

  // The decision point is the only strong focus. No spinning rings or neon bloom.
  const nodeLight = reduced ? focused : sequence.node * (1 - focused) + focused * .7
  circle(decision, 28, line)
  ctx.globalAlpha = nodeLight * .7
  circle(decision, 28, lime)
  ctx.globalAlpha = 1
  circle(decision, 20, lime, ink)
  ctx.globalAlpha = nodeLight * .1
  circle(decision, 20, lime, lime)
  ctx.globalAlpha = 1
  path([[226, 272], [234, 264], [242, 272], [234, 280], [226, 272]], lime, 1.2)
  circle(decision, 2, lime, lime)
  text('ВАШЕ РЕШЕНИЕ', compact ? 168 : 190, 215, white)
  path([[234, 225], [234, 239]], purple, .8)
}

export function MarketSimulation() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const theme = useTheme()

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return // The underlying SVG poster remains visible.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    let frame = 0, elapsed = 0, lastTime = 0, lastPaint = 0
    let visible = false
    let compact = false
    let scale = 1
    let hovered: number | null = null
    let pointer: Point | null = null
    let focus = [0, 0, 0]
    const paint = () => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      draw(ctx, reduced.matches ? 0 : elapsed, theme === 'dark', compact, focus, reduced.matches)
      element.dataset.ready = 'true'
    }
    const tick = (now: number) => {
      const delta = lastTime ? Math.min(now - lastTime, 100) : 0
      if (hovered === null) elapsed += delta
      // Recheck a stationary pointer as the gently moving paths pass beneath it.
      if (pointer) hovered = routeAt(pointer, elapsed)
      const blend = 1 - Math.exp(-delta / 140)
      focus = focus.map((value, index) => value + ((hovered === index ? 1 : 0) - value) * blend)
      element.dataset.hovered = hovered === null ? '' : String(hovered)
      lastTime = now
      if (now - lastPaint >= 1000 / 30) { paint(); lastPaint = now }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      if (reduced.matches) focus = focus.map((_, index) => hovered === index ? 1 : 0)
      paint()
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick)
    }
    const clearHover = () => {
      hovered = null
      pointer = null
      element.dataset.hovered = ''
      if (reduced.matches) { focus = [0, 0, 0]; paint() }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!hover.matches || event.pointerType === 'touch') return
      const bounds = element.getBoundingClientRect()
      pointer = [(event.clientX - bounds.left) * 620 / bounds.width, (event.clientY - bounds.top) * 540 / bounds.height]
      hovered = routeAt(pointer, reduced.matches ? 0 : elapsed)
      element.dataset.hovered = hovered === null ? '' : String(hovered)
      if (reduced.matches) { focus = focus.map((_, index) => hovered === index ? 1 : 0); paint() }
    }
    const onVisibility = () => { if (document.hidden) clearHover(); sync() }
    const resize = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (!width) return
      compact = width < 400
      scale = width * Math.min(window.devicePixelRatio || 1, 2) / 620
      element.width = Math.round(620 * scale)
      element.height = Math.round(540 * scale)
      paint()
    })
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    resize.observe(element)
    intersection.observe(element)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerleave', clearHover)
    hover.addEventListener('change', clearHover)
    window.addEventListener('blur', clearHover)
    reduced.addEventListener('change', sync)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      intersection.disconnect()
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerleave', clearHover)
      hover.removeEventListener('change', clearHover)
      window.removeEventListener('blur', clearHover)
      reduced.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [theme])

  return <canvas ref={canvas} className={styles.canvas} width="620" height="540" />
}
