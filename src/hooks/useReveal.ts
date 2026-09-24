import { useCallback, useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Пошаговое раскрытие свечей.
 *
 * Анимация здесь функциональная: игрок должен успеть увидеть, как именно
 * развивалось движение, а не получить готовый результат мгновенно.
 *
 * Интервал и колбэк живут вне updater'а React — иначе Strict Mode
 * и повторный вызов setState обрывают раскрытие на середине.
 */
export function useReveal(initial: number, stepMs = 85) {
  const [visible, setVisible] = useState(initial)
  const visibleRef = useRef(initial)
  const targetRef = useRef(initial)
  const timerRef = useRef<number | null>(null)
  const onDoneRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finish = useCallback(() => {
    stop()
    const callback = onDoneRef.current
    onDoneRef.current = null
    if (callback) window.setTimeout(callback, 220)
  }, [stop])

  const revealTo = useCallback(
    (target: number, onDone?: () => void) => {
      stop()
      targetRef.current = target
      onDoneRef.current = onDone ?? null

      if (prefersReducedMotion() || visibleRef.current >= target) {
        visibleRef.current = target
        setVisible(target)
        finish()
        return
      }

      timerRef.current = window.setInterval(() => {
        const next = Math.min(visibleRef.current + 1, targetRef.current)
        visibleRef.current = next
        setVisible(next)
        if (next >= targetRef.current) finish()
      }, stepMs)
    },
    [finish, stepMs, stop],
  )

  const reset = useCallback(
    (value: number) => {
      stop()
      onDoneRef.current = null
      visibleRef.current = value
      targetRef.current = value
      setVisible(value)
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return { visible, revealTo, reset, isRevealing: timerRef.current !== null }
}
