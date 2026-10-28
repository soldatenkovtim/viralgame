import { useEffect, useRef } from 'react'
import { useTheme } from '@/lib/theme'
import { drawMarketLandscape } from './marketLandscapeDrawing'
import styles from './HeroVisual.module.css'

/** Canvas terrain with an SVG poster underneath for first paint / unavailable canvas. */
export function MarketLandscape() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const theme = useTheme()

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, elapsed = 0, previous = 0, lastPaint = 0, scale = 1
    let visible = false
    const paint = () => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      drawMarketLandscape(ctx, reduced.matches ? 0 : elapsed, theme === 'dark')
      element.dataset.ready = 'true'
    }
    const tick = (now: number) => {
      if (previous) elapsed += Math.min(now - previous, 100)
      previous = now
      if (now - lastPaint >= 1000 / 30) { paint(); lastPaint = now }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      previous = 0
      paint()
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick)
    }
    const resize = new ResizeObserver(([entry]) => {
      if (!entry.contentRect.width) return
      scale = entry.contentRect.width * Math.min(devicePixelRatio || 1, 2) / 620
      element.width = Math.round(620 * scale)
      element.height = Math.round(540 * scale)
      paint()
    })
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    resize.observe(element)
    intersection.observe(element)
    reduced.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      intersection.disconnect()
      reduced.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [theme])

  return <canvas ref={canvas} className={styles.canvas} width="620" height="540" />
}
