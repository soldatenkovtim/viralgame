import { useEffect, useRef, type ReactNode } from 'react'
import { MarketSimulation } from './MarketSimulation'
import { MarketLandscape } from './MarketLandscape'
import styles from './HeroVisual.module.css'

const POSTERS = {
  landscape: '/media/market-landscape-poster.svg',
  scenario: '/media/market-simulation-poster.svg',
}

export type HeroMedia =
  | { kind: 'video'; poster: string; webm?: string; mp4?: string }
  | { kind: 'image'; src: string; poster: string }

/** Replace the renderer here without changing the hero's layout or copy.
 * `children` is the slot for a future Lottie renderer; it must respect reduced motion.
 */
export function HeroVisual({ media, children, variant = 'landscape' }: { media?: HeroMedia; children?: ReactNode; variant?: keyof typeof POSTERS }) {
  const container = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    const sync = () => {
      const running = visible && !document.hidden && !reduced.matches
      element.dataset.running = String(running)
      if (!video.current) return
      if (running) void video.current.play().catch(() => { /* The poster remains visible. */ })
      else video.current.pause()
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(element)
    reduced.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      observer.disconnect()
      reduced.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [media])

  return <div ref={container} className={styles.visual} aria-hidden="true">
    <div className={`${styles.stage}${!media && children == null ? ` ${styles.simulation}` : ''}`}>
      <img className={styles.poster} src={media?.poster ?? POSTERS[variant]} width="620" height="540" alt="" decoding="async" />
      {children ?? (media?.kind === 'video'
        ? <video key={`${media.webm}/${media.mp4}`} ref={video} className={styles.media} autoPlay muted loop playsInline preload="metadata" poster={media.poster} tabIndex={-1}>
          {media.webm && <source src={media.webm} type="video/webm" />}
          {media.mp4 && <source src={media.mp4} type="video/mp4" />}
        </video>
        : media?.kind === 'image'
          ? <img className={styles.media} src={media.src} alt="" width="620" height="540" />
          : variant === 'scenario' ? <MarketSimulation /> : <MarketLandscape />)}
    </div>
  </div>
}
