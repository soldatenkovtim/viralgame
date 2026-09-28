import { useMemo } from 'react'
import { ArrowRight, Eye } from 'lucide-react'
import { QuoteChart, QuoteLegend } from '@/components/charts/QuoteChart'
import {
  AchievementNote,
  MetricGrid,
  PersonalBestNote,
  ProfileProgressBlock,
  ResultHeader,
} from '@/components/results/ResultBlocks'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { flowRegimeExplanation, flowRegimeLabels } from '@/data/marketMakerScenarios'
import { marketMakerAchievement } from '@/lib/achievements'
import { formatMoney, formatNumber, formatPrice, formatSigned, pnlColor } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { MarketMakerResult as MMResult, MMPhaseStats } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import { tickToSeconds } from './market'
import { marketMakerInsights } from './scoring'

export function MarketMakerResult({
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  result: MMResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => marketMakerAchievement(result), [result])
  const insights = useMemo(() => marketMakerInsights(result), [result])

  const sharePayload: SharePayload = {
    t: 'market-maker',
    s: result.scenarioId,
    d: result.seed,
    r: Number(result.pnl.toFixed(0)),
    a: [
      `Спред ${formatMoney(result.spreadPnl)}`,
      `Инвентарь до ${result.maxInventory}`,
      `Хедж ${result.hedgeCount}`,
    ],
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 02 · Маркет-мейкер" headline="Рынок закрыт">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`tnum text-3xl font-light ${pnlColor(result.pnl)}`}>
            PnL: {formatMoney(result.pnl)}
          </p>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <PnlBreakdown result={result} />
        <MetricGrid>
          <Stat label="Максимальный inventory" value={formatNumber(result.maxInventory)} />
          <Stat label="Количество сделок" value={formatNumber(result.tradeCount)} />
          <Stat label="Средний спред" value={formatPrice(result.averageSpread)} />
          <Stat label="Хедж использован" value={formatNumber(result.hedgeCount)} />
          <Stat
            label="Над мягким лимитом"
            value={`${formatNumber(result.secondsAboveSoftLimit, 0)} с`}
            valueClassName={result.secondsAboveSoftLimit > 0 ? 'text-risk' : ''}
          />
          <Stat label="Очки испытания" value={formatNumber(outcome.points)} />
        </MetricGrid>
      </div>

      <PersonalBestNote
        isPersonalBest={outcome.isPersonalBest}
        pointsToBest={outcome.pointsToBest}
        points={outcome.points}
        hasPrevious={outcome.previousBest !== null}
      />

      <FairValueReplay result={result} />

      <section className="rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
        <h3 className="mb-4 text-lg font-normal tracking-tight text-chalk-50">Как прошёл раунд</h3>
        <ul className="flex max-w-3xl flex-col gap-3">
          {insights.map((text) => (
            <li key={text} className="text-base leading-relaxed text-chalk-200">
              {text}
            </li>
          ))}
        </ul>
      </section>

      <AchievementNote achievement={achievement} />

      <div className="flex flex-col gap-6 border-t border-ink-800 pt-10">
        <ShareChallengeButton payload={sharePayload} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Disclaimer>
            Поток заявок и справедливая цена смоделированы для прототипа и не воспроизводят
            реальный рынок.
          </Disclaimer>
          <LinkButton to={nextHref} variant="primary" size="lg">
            {nextLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        </div>
      </div>
    </div>
  )
}

function PnlBreakdown({ result }: { result: MMResult }) {
  const rows = [
    { label: 'Заработано на спреде', value: result.spreadPnl },
    { label: 'Переоценка inventory', value: result.inventoryPnl },
    { label: 'Стоимость хеджирования', value: -result.hedgeCosts },
  ]

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-6">
      <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
        Из чего сложился PnL
      </span>
      <dl className="tnum flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-chalk-400">{row.label}</dt>
            <dd className={row.value === 0 ? 'text-chalk-400' : pnlColor(row.value)}>
              {formatMoney(row.value)}
            </dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-ink-700 pt-4">
          <dt className="text-chalk-50">Итоговый PnL</dt>
          <dd className={`text-2xl font-light ${pnlColor(result.pnl)}`}>{formatMoney(result.pnl)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-chalk-500">
        Inventory на закрытии: {formatSigned(result.finalInventory)}. Открытая позиция
        оценена по последней рыночной цене.
      </p>
    </section>
  )
}

function FairValueReplay({ result }: { result: MMResult }) {
  const timeline = result.timeline
  const informedTicks = useMemo(() => {
    const ticks = new Set<number>()
    if (!timeline) return ticks
    for (const point of timeline) {
      const second = tickToSeconds(point.tick)
      const informed = result.phases.some(
        (phase) => phase.regime === 'informed' && second >= phase.from && second < phase.to,
      )
      if (informed) ticks.add(point.tick)
    }
    return ticks
  }, [timeline, result.phases])

  const duration = result.phases.length ? result.phases[result.phases.length - 1].to : 60

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-violet-soft" aria-hidden />
          <span className="text-[11px] tracking-[0.18em] text-violet-soft uppercase">
            Что было скрыто
          </span>
        </div>
        <h2 className="text-2xl font-light tracking-tight text-chalk-50 sm:text-3xl">
          Справедливая цена и смена потока
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-chalk-400">
          Фиолетовая линия — справедливая цена, которую ты не видел. Жёлтая полоса снизу
          отмечает моменты, когда середина твоей котировки заметно отставала от неё:
          там поток забирал у тебя выгодную ему сторону.
        </p>
      </div>

      {timeline && timeline.length > 1 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
          <QuoteChart
            points={timeline}
            trades={result.trades ?? []}
            totalTicks={timeline[timeline.length - 1].tick}
            informedTicks={informedTicks}
            height={340}
            showTimeAxis
          />
          <QuoteLegend replay />
        </div>
      ) : null}

      <PhaseStrip phases={result.phases} duration={duration} />
    </section>
  )
}

function PhaseStrip({ phases, duration }: { phases: MMPhaseStats[]; duration: number }) {
  if (!phases.length) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-hidden rounded-lg border border-ink-700">
        {phases.map((phase, index) => (
          <div
            key={`${phase.regime}-${phase.from}`}
            className={`flex min-w-0 flex-col gap-1 px-3 py-2.5 ${
              index > 0 ? 'border-l border-ink-700' : ''
            } ${phase.regime === 'informed' ? 'bg-violet-accent/15' : 'bg-ink-900'}`}
            style={{ width: `${((phase.to - phase.from) / duration) * 100}%` }}
          >
            <span className="truncate text-xs text-chalk-200">{flowRegimeLabels[phase.regime]}</span>
            <span className="tnum text-[11px] text-chalk-500">
              {phase.from}–{phase.to} с
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {phases.map((phase) => (
          <div
            key={`${phase.regime}-${phase.from}-stats`}
            className="flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-chalk-50">{flowRegimeLabels[phase.regime]}</span>
              <span className="tnum text-xs text-chalk-500">
                {phase.from}–{phase.to} с
              </span>
            </div>
            <p className="text-xs leading-relaxed text-chalk-400">
              {flowRegimeExplanation[phase.regime]}
            </p>
            <dl className="tnum mt-1 grid grid-cols-3 gap-2 text-xs">
              <PhaseFigure label="Сделок" value={formatNumber(phase.fills)} />
              <PhaseFigure label="Спред" value={formatPrice(phase.averageSpread)} />
              <PhaseFigure
                label="PnL"
                value={formatMoney(phase.pnlChange)}
                className={pnlColor(phase.pnlChange)}
              />
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

function PhaseFigure({
  label,
  value,
  className = 'text-chalk-200',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-chalk-500">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  )
}
