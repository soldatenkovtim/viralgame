import { useEffect, useId, useRef, useState } from 'react'
import { Info, X } from 'lucide-react'
import { traitLabels, traitOrder, type ProfileInput, type TraitKey } from '@/lib/profile'
import { traitEvidence, traitExplanations } from '@/lib/profilePresentation'
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
  input,
}: {
  profile: TradingProfile
  animate?: boolean
  input?: ProfileInput
}) {
  const [revealed, setRevealed] = useState(!animate)
  const [active, setActive] = useState<TraitKey>('marketSense')
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
          onExplain={input ? () => { setActive(trait); dialog.current?.showModal() } : undefined}
        />
      ))}
      {input && <>
        <p className="text-xs leading-relaxed text-chalk-500">Нажмите на название, чтобы узнать, из чего складывается характеристика.</p>
        <dialog ref={dialog} aria-labelledby={titleId}
          className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-6 text-chalk-200 shadow-2xl backdrop:bg-black/60 sm:p-8"
          onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
          <div className="flex items-start justify-between gap-4">
            <h3 id={titleId} className="text-xl text-chalk-50">{traitLabels[active]} · {profile[active]}/100</h3>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Закрыть пояснение" className="shrink-0 rounded p-1 text-chalk-400 focus-visible:outline-2 focus-visible:outline-violet-accent"><X size={20} /></button>
          </div>
          <p className="mt-5 text-sm leading-relaxed">{traitExplanations[active].meaning}</p>
          <p className="mt-4 text-sm leading-relaxed text-chalk-400">{traitExplanations[active].sources}</p>
          <p className="mt-4 text-sm leading-relaxed text-chalk-400">{traitExplanations[active].interpretation}</p>
          <p className="mt-4 text-sm leading-relaxed text-violet-soft">{traitEvidence(active, input) ?? `Сохранённая оценка — ${profile[active]}/100. Детальных данных для отдельного наблюдения недостаточно.`}</p>
          <p className="mt-5 border-t border-ink-700 pt-4 text-xs leading-relaxed text-chalk-500">Это упрощённая игровая модель. Вклады испытаний усредняются с заданными весами, затем результат переводится в диапазон 20–95 на шкале из 100. Это не процент правильных решений и не оценка квалификации.</p>
        </dialog>
      </>}
    </div>
  )
}

function TraitRow({
  trait,
  value,
  revealed,
  delayMs,
  onExplain,
}: {
  trait: TraitKey
  value: number
  revealed: boolean
  delayMs: number
  onExplain?: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        {onExplain ? <button type="button" onClick={onExplain} aria-haspopup="dialog" className="flex min-h-8 items-center gap-2 rounded text-left text-base text-chalk-200 hover:text-violet-soft focus-visible:outline-2 focus-visible:outline-violet-accent">{traitLabels[trait]}<Info size={14} className="shrink-0 text-chalk-500" aria-hidden /></button>
          : <span className="text-base text-chalk-200">{traitLabels[trait]}</span>}
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
