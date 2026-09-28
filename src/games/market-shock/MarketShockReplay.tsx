import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { CHART_COLORS } from '@/components/charts/TradingChart'
import { useReveal } from '@/hooks/useReveal'
import { formatPercent, formatPrice } from '@/lib/formatting'
import type { MarketShockResult, MarketShockScenario } from '@/types/game'
import {
  actionPastLabels,
  decisionCandleIndex,
  initialExposure,
  positionLabel,
} from './engine'
import { MarketShockChart } from './MarketShockChart'

/**
 * Разбор на том же графике: весь путь цены, вход, каждое решение с размером
 * позиции после него, уровни игрока, точки максимальной просадки и максимального PnL.
 */
export function MarketShockReplay({
  scenario,
  result,
}: {
  scenario: MarketShockScenario
  result: MarketShockResult
}) {
  const total = scenario.candles.length
  const [playing, setPlaying] = useState(false)
  const { visible, revealTo, reset } = useReveal(total, 40, 1)
  const exit = result.decisions.find((decision) => decision.positionAfter === 0)
  const exitTime = exit ? scenario.candles[decisionCandleIndex(scenario, exit.phase)].time : undefined
  const startIndex = scenario.initialVisibleIndex - 1

  const markers = useMemo<ChartMarker[]>(() => {
    const list: ChartMarker[] = [
      {
        candleIndex: startIndex,
        position: 'belowBar',
        shape: 'square',
        color: CHART_COLORS.entry,
        text: `Старт · ${positionLabel(initialExposure(scenario))}`,
      },
    ]

    result.decisions.forEach((decision) => {
      list.push({
        candleIndex: decisionCandleIndex(scenario, decision.phase),
        position: 'aboveBar',
        shape: 'circle',
        color: '#9b84ff',
        text: decision.positionAfter === 0
          ? `Полный выход · ${formatPrice(decision.price)}`
          : `${decision.phase}. ${actionPastLabels[decision.action]} · ${positionLabel(decision.positionAfter)}`,
      })
    })

    if (result.maxDrawdown >= 0.1) {
      list.push({
        candleIndex: result.maxDrawdownIndex,
        position: 'belowBar',
        shape: 'arrowUp',
        color: CHART_COLORS.down,
        text: `Макс. просадка ${formatPercent(-result.maxDrawdown)}`,
      })
    }

    if (result.maxPnlIndex > startIndex) {
      list.push({
        candleIndex: result.maxPnlIndex,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: CHART_COLORS.up,
        text: `Макс. PnL ${formatPercent(result.maxPnlPercent)}`,
      })
    }

    return list
  }, [result, scenario, startIndex])

  const play = () => {
    setPlaying(true)
    reset(scenario.initialVisibleIndex)
    revealTo(total, () => setPlaying(false))
  }

  return (
    <section className="flex flex-col gap-0">
      <MarketShockChart
        scenario={scenario}
        visibleCount={visible}
        position={initialExposure(scenario)}
        levels={result.levels}
        markers={markers}
        mutedAfter={exitTime}
        editable={false}
        className="h-[clamp(380px,60vh,600px)]"
        toolbarExtra={
          <button
            type="button"
            onClick={play}
            disabled={playing}
            className="flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950 px-3 text-xs text-chalk-200 transition-colors duration-150 hover:border-ink-500 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {playing ? 'Воспроизведение…' : 'Воспроизвести'}
          </button>
        }
      />
      {exit ? (
        <p className="mt-3 text-xs text-chalk-400">
          Полный выход: {formatPrice(exit.price)} · PnL {formatPercent(result.pnlPercent, 2)}.
          Серые свечи — рынок после закрытия позиции.
        </p>
      ) : null}
      <ExposureStrip scenario={scenario} result={result} />
    </section>
  )
}

/** Полоса экспозиции под графиком: сколько позиции было на каждом участке. */
function ExposureStrip({
  scenario,
  result,
}: {
  scenario: MarketShockScenario
  result: MarketShockResult
}) {
  const start = scenario.initialVisibleIndex - 1
  const end = scenario.candles.length - 1
  const span = end - start

  const segments = [
    { from: start, exposure: initialExposure(scenario) },
    ...result.decisions.map((decision) => ({
      from: decisionCandleIndex(scenario, decision.phase),
      exposure: decision.positionAfter,
    })),
  ]
    .filter((segment, index, all) => index === 0 || segment.exposure !== all[index - 1].exposure)
    .map((segment, index, all) => ({
    ...segment,
    to: all[index + 1]?.from ?? end,
  }))

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-chalk-500">
        <span>Экспозиция по ходу сценария</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Legend color={CHART_COLORS.entry} label="ENTRY — средняя цена" dashed />
          {result.levels.length ? <Legend color={CHART_COLORS.level} label="Твои уровни" /> : null}
        </span>
      </div>
      <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-md">
        {segments.map((segment, index) => {
          const size = Math.abs(segment.exposure)
          return (
            <div
              key={index}
              className="relative flex items-center justify-center overflow-hidden bg-ink-950"
              style={{ width: `${((segment.to - segment.from) / span) * 100}%` }}
              title={positionLabel(segment.exposure)}
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-violet-accent/35"
                style={{ height: `${size * 100}%` }}
              />
              <span className="tnum relative text-[11px] whitespace-nowrap text-chalk-200">
                {positionLabel(segment.exposure)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-4 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
      {label}
    </span>
  )
}
