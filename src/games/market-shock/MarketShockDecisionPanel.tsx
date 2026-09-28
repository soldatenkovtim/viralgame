import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChoiceButton } from '@/components/ui/ChoiceButton'
import { formatPercent, formatPrice, pnlColor } from '@/lib/formatting'
import type { ShockAction } from '@/types/game'
import {
  actionLabels,
  applyShockAction,
  DECISION_SECONDS,
  isActionEffective,
  positionLabel,
  SHOCK_ACTIONS,
} from './engine'

export function PositionSummary({
  position,
  pnlPercent,
  entryPrice,
  price,
  caption,
}: {
  position: number
  pnlPercent: number
  entryPrice: number
  price: number
  caption?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <Field label="Позиция" value={positionLabel(position)} />
        <Field label="PnL" value={formatPercent(pnlPercent, 2)} valueClass={pnlColor(pnlPercent)} align="end" />
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-ink-800 pt-3">
        <Field label="Средняя цена" value={formatPrice(entryPrice)} small />
        <Field label="Текущая" value={formatPrice(price)} small align="end" />
      </div>
      {caption ? <span className="text-xs text-chalk-500">{caption}</span> : null}
    </div>
  )
}

function hintFor(position: number, action: ShockAction): string {
  const next = applyShockAction(position, action)
  if (next === position) return `Останется: ${positionLabel(position)}`
  return `Станет: ${positionLabel(next)}`
}

export function MarketShockDecisionPanel({
  phaseNumber,
  position,
  deciding,
  remaining,
  totalSeconds = DECISION_SECONDS,
  timerDisabled,
  selected,
  notice,
  onSelect,
  onConfirm,
}: {
  phaseNumber: number
  position: number
  /** false — свечи ещё дорисовываются, кнопки неактивны. */
  deciding: boolean
  remaining: number
  totalSeconds?: number
  timerDisabled: boolean
  selected: ShockAction | null
  notice?: string | null
  onSelect: (action: ShockAction) => void
  onConfirm: () => void
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="tnum text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
          Решение {phaseNumber} из 3
        </span>
        {deciding && !timerDisabled ? <Countdown total={totalSeconds} remaining={remaining} /> : null}
      </div>

      {notice ? (
        <p className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-chalk-400">
          {notice}
        </p>
      ) : null}

      <h2 className="text-lg font-normal tracking-tight text-chalk-50">Что делать с позицией?</h2>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
        {SHOCK_ACTIONS.map((action) => {
          const effective = action === 'hold' || isActionEffective(position, action)
          return (
            <ChoiceButton
              key={action}
              compact
              label={actionLabels[action]}
              hint={hintFor(position, action)}
              selected={selected === action}
              disabled={!deciding || !effective}
              onClick={() => onSelect(action)}
            />
          )
        })}
      </div>

      <Button variant="primary" size="lg" fullWidth disabled={!deciding || !selected} onClick={onConfirm}>
        {deciding ? 'Подтвердить решение' : 'Рынок двигается…'}
        {deciding ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </Button>
    </section>
  )
}

function Countdown({ remaining, total }: { remaining: number; total: number }) {
  const urgent = remaining <= 5
  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <span className={`tnum text-sm ${urgent ? 'text-market-down' : 'text-chalk-200'}`}>
        {remaining} с
      </span>
      <div className="h-0.5 w-16 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            urgent ? 'bg-market-down' : 'bg-chalk-500'
          }`}
          style={{ width: `${(remaining / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  valueClass = 'text-chalk-50',
  align = 'start',
  small = false,
}: {
  label: string
  value: string
  valueClass?: string
  align?: 'start' | 'end'
  small?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${align === 'end' ? 'items-end' : ''}`}>
      <span className="text-[10px] tracking-[0.14em] text-chalk-500 uppercase">{label}</span>
      <span className={`tnum ${small ? 'text-sm' : 'text-lg font-light'} ${valueClass}`}>{value}</span>
    </div>
  )
}
