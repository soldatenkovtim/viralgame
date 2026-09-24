import { useEffect, useState } from 'react'
import { traitLabels, traitOrder, type TraitKey } from '@/lib/profile'
import type { TradingProfile } from '@/types/game'

/**
 * Характеристики профиля.
 *
 * Слово «балл» намеренно нигде не используется: это описание поведения
 * в игровой сессии, а не оценка человека.
 */
export function TraitBars({
  profile,
  animate = true,
}: {
  profile: TradingProfile
  animate?: boolean
}) {
  const [revealed, setRevealed] = useState(!animate)

  useEffect(() => {
    if (!animate) return
    const timeout = window.setTimeout(() => setRevealed(true), 120)
    return () => window.clearTimeout(timeout)
  }, [animate])

  return (
    <div className="flex flex-col gap-6">
      {traitOrder.map((trait, index) => (
        <TraitRow
          key={trait}
          trait={trait}
          value={profile[trait]}
          revealed={revealed}
          delayMs={index * 90}
        />
      ))}
    </div>
  )
}

function TraitRow({
  trait,
  value,
  revealed,
  delayMs,
}: {
  trait: TraitKey
  value: number
  revealed: boolean
  delayMs: number
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-base text-chalk-200">{traitLabels[trait]}</span>
        <span className="tnum text-2xl leading-none font-light text-chalk-50">{value}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-violet-accent transition-[width] duration-[1100ms] ease-out"
          style={{
            width: revealed ? `${value}%` : '0%',
            transitionDelay: `${delayMs}ms`,
          }}
        />
      </div>
    </div>
  )
}
