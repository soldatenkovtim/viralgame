import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  if (action === 'hedge') return `Экспозиция: ${positionLabel(next)}`
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
    <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="tnum text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
          Решение {String(phaseNumber).padStart(2, '0')} из 03
        </span>
        <span className="text-xs text-chalk-400">{!deciding ? "Рынок двигается…" : timerDisabled ? "Без ограничения времени" : "Осталось"}</span>
      </div>

      <Countdown total={totalSeconds} remaining={remaining} active={deciding && !timerDisabled} />



      <h2 className="text-lg font-normal tracking-tight text-chalk-50">Что делать с позицией?</h2>

      <div className="grid grid-cols-2 gap-2">
        {SHOCK_ACTIONS.map((action) => {
          const effective = action === 'hold' || isActionEffective(position, action)
          return (
            <button key={action} type="button" aria-pressed={selected === action}
              disabled={!deciding || !effective} onClick={() => onSelect(action)}
              className={`min-w-0 rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${selected === action
                ? 'border-violet-accent bg-violet-accent/10 text-chalk-50'
                : 'border-ink-700 text-chalk-200 enabled:hover:border-violet-accent/60'}`}>
              <span className="flex items-center justify-between gap-1 text-sm font-medium">
                {actionLabels[action]}<Check size={14} className={selected === action ? 'shrink-0 text-violet-accent' : 'invisible shrink-0'} aria-hidden />
              </span>
              <span className="mt-1 block text-xs leading-snug text-chalk-400">
                {!effective ? (position === 0 ? 'Позиция закрыта' : action === 'increase' ? 'Достигнут лимит позиции' : 'Размер не изменится') : hintFor(position, action)}
              </span>
            </button>
          )
        })}
      </div>

      <p className="min-h-8 text-xs leading-4 text-chalk-400" role="status">{notice ?? (timerDisabled ? "Выберите действие и подтвердите решение." : "Без подтверждения до конца отсчёта позиция останется без изменений.")}</p>

      <Button variant="primary" size="lg" fullWidth disabled={!deciding || !selected} onClick={onConfirm}>
        {deciding ? 'Подтвердить решение' : 'Рынок двигается…'}
        {deciding ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </Button>
    </section>
  )
}

function Countdown({ remaining, total, active }: { remaining: number; total: number; active: boolean }) {
  const seconds = Math.max(0, Math.min(total, remaining))
  const tone = !active ? 'text-chalk-500' : seconds <= 5 ? 'text-market-down' : seconds <= 10 ? 'text-amber-400' : 'text-violet-accent'
  return (
    <div className={tone}>
      <div className="tnum text-3xl font-medium leading-none" aria-label={active ? `Осталось ${seconds} секунд` : 'Отсчёт не идёт'}>
        {active ? seconds : '—'} <span className="text-sm">с</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-label="Время на решение"
        aria-valuemin={0} aria-valuemax={total} aria-valuenow={active ? seconds : 0}>
        <div className="h-full bg-current" style={{ width: `${active && total > 0 ? seconds / total * 100 : 0}%` }} />
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
