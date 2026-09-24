import { useEffect, useRef, useState } from 'react'

/**
 * Countdown для решений в «Рыночном шоке».
 *
 * Таймер создаёт давление, но никогда не приводит к проигрышу: по истечении
 * времени решение принимается автоматически.
 */
export function useCountdown({
  seconds,
  active,
  onExpire,
  resetKey,
  disabled = false,
}: {
  seconds: number
  active: boolean
  onExpire: () => void
  resetKey: string | number
  disabled?: boolean
}) {
  const [remaining, setRemaining] = useState(seconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setRemaining(seconds)
  }, [resetKey, seconds])

  useEffect(() => {
    if (!active || disabled) return

    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          onExpireRef.current()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [active, disabled, resetKey])

  return { remaining, progress: seconds > 0 ? remaining / seconds : 0 }
}
