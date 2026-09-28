import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { getTimeframe } from '@/games/blind-market/timeframes'
import { CAPITAL } from '@/lib/constants'
import { formatPercent, formatPrice, pnlColor } from '@/lib/formatting'
import type { MarketShockScenario } from '@/types/game'
import { DECISION_SECONDS, initialExposure, positionLabel } from './engine'

export function MarketShockIntro({
  scenario,
  pnlPercent,
  onStart,
}: {
  scenario: MarketShockScenario
  /** Текущий результат позиции относительно средней цены, % к капиталу. */
  pnlPercent: number
  onStart: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 03</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Рыночный шок
        </h1>
      </div>

      <p className="text-base leading-relaxed text-chalk-200">
        Тебе передали уже открытую позицию. Сначала оцени рынок, затем управляй позицией по мере
        развития ситуации.
      </p>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-3">
        <Field label="Капитал" value={CAPITAL.toLocaleString('ru-RU')} />
        <Field label="Позиция" value={positionLabel(initialExposure(scenario))} />
        <Field label="Средняя цена" value={formatPrice(scenario.initialPosition.entryPrice)} />
        <Field label="Текущий PnL" value={formatPercent(pnlPercent)} valueClass={pnlColor(pnlPercent)} />
        <Field label="Основной ТФ" value={getTimeframe(scenario.primaryTimeframe).label} />
        <Field label="Старший ТФ" value={getTimeframe(scenario.contextTimeframe).label} />
      </dl>

      <p className="text-xs leading-relaxed text-chalk-500">
        Рынок будет развиваться в три этапа. На каждое решение — {scenario.mode === 'advanced' ? 13 : DECISION_SECONDS} секунд; отсчёт
        начнётся только после того, как ты изучишь график. PnL считается в процентах от капитала.
      </p>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Открыть рынок
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function Field({
  label,
  value,
  valueClass = 'text-chalk-50',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">{label}</dt>
      <dd className={`tnum text-lg font-light ${valueClass}`}>{value}</dd>
    </div>
  )
}
