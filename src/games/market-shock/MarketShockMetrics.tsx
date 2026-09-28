import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { formatNumber, formatPercent, formatSigned } from '@/lib/formatting'
import type { MarketShockContext, MarketShockPhase } from '@/types/game'
import { PHASE_TITLES } from './engine'

/** Состояние рынка: на этапе контекста — словами, в фазах — изменениями к истории. */
export function MarketShockMetrics({
  context,
  phase,
  phaseNumber,
  pending = false,
}: {
  context: MarketShockContext
  phase?: MarketShockPhase
  phaseNumber?: number
  /** Свечи фазы ещё дорисовываются — метрики появятся после. */
  pending?: boolean
}) {
  if (!phase || !phaseNumber) {
    return (
      <Panel title="Состояние рынка">
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Волатильность" value={context.volatility} />
          <Metric label="Ликвидность" value={context.liquidity} />
          <Metric label="Объём" value={`${formatNumber(context.volumeMultiplier, 1)}× среднего`} />
        </div>
      </Panel>
    )
  }

  const title = `Фаза ${phaseNumber} · ${PHASE_TITLES[phaseNumber - 1]}`

  if (pending) {
    return (
      <Panel title={title}>
        <p className="text-sm text-chalk-400">Рынок двигается…</p>
      </Panel>
    )
  }

  const severe = phase.volatilityChange >= 150

  return (
    <Panel title={title} severe={severe}>
      <p className="text-sm leading-relaxed text-chalk-200">{phase.marketDescription}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-800 pt-3">
        <Metric
          label="Цена"
          value={formatPercent(phase.priceChange)}
          valueClass={phase.priceChange >= 0 ? 'text-market-up' : 'text-market-down'}
        />
        <Metric label="Волатильность" value={`${formatSigned(phase.volatilityChange)}%`} />
        <Metric label="Ликвидность" value={`${formatSigned(phase.liquidityChange)}%`} />
        <Metric label="Объём" value={`${formatNumber(phase.volumeMultiplier, 1)}×`} />
      </div>
    </Panel>
  )
}

function Panel({
  title,
  severe = false,
  children,
}: {
  title: string
  severe?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`flex animate-fade flex-col gap-3 rounded-xl border p-4 ${
        severe ? 'border-market-down/35 bg-market-down/6' : 'border-ink-700 bg-ink-900'
      }`}
    >
      <div className="flex items-center gap-2">
        {severe ? <TriangleAlert className="h-3.5 w-3.5 text-market-down" aria-hidden /> : null}
        <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">{title}</span>
      </div>
      {children}
    </section>
  )
}

function Metric({
  label,
  value,
  valueClass = 'text-chalk-50',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-[0.12em] text-chalk-500 uppercase">{label}</span>
      <span className={`tnum text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}
