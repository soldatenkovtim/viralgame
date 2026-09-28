import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { CHART_COLORS, TradingChart } from '@/components/charts/TradingChart'
import { useReveal } from '@/hooks/useReveal'
import type { BlindMarketResult, BlindMarketScenario, ChartAnnotations } from '@/types/game'
import { TimeframeSwitch } from './ChartToolbar'
import { actionShortLabels, buildTradeTimeline } from './scoring'
import { DEFAULT_TIMEFRAME, type TimeframeId } from './timeframes'
import { legSegments, tradeMarkers } from './tradeAnnotations'

const EMPTY_ANNOTATIONS: ChartAnnotations = { levels: [], trendLine: null }

/**
 * Полный разбор сессии на том же рабочем графике: входы, изменения позиции,
 * стопы, выход и собственная разметка игрока. Можно проиграть заново.
 */
export function BlindReplay({
  scenario,
  result,
}: {
  scenario: BlindMarketScenario
  result: BlindMarketResult
}) {
  const total = scenario.candles.length
  const [timeframe, setTimeframe] = useState<TimeframeId>(DEFAULT_TIMEFRAME)
  const [playing, setPlaying] = useState(false)
  const { visible, revealTo, reset } = useReveal(total, 30, 3)

  const timeline = useMemo(
    () => buildTradeTimeline(scenario, result.decisions, visible - 1, true),
    [scenario, result.decisions, visible],
  )

  const markers = useMemo<ChartMarker[]>(() => {
    const list = tradeMarkers(timeline.events)
    // Решения без изменения позиции тоже видны — иначе «Держал» пропадает из разбора.
    result.decisions.forEach((decision, index) => {
      const candleIndex = scenario.checkpoints[index] - 1
      if (timeline.events.some((event) => event.candleIndex === candleIndex)) return
      list.push({
        candleIndex,
        position: 'aboveBar',
        shape: 'circle',
        color: '#6b6b78',
        text:
          decision.action && decision.action !== 'stay-flat'
            ? actionShortLabels[decision.action]
            : 'Вне рынка',
      })
    })
    return list
  }, [timeline.events, result.decisions, scenario.checkpoints])

  const segments = useMemo(() => legSegments(scenario, timeline.legs), [scenario, timeline.legs])
  const annotations = result.annotations ?? EMPTY_ANNOTATIONS

  const play = () => {
    setPlaying(true)
    reset(scenario.checkpoints[0])
    revealTo(total, () => setPlaying(false))
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <h3 className="text-sm text-chalk-200">Разбор сессии</h3>
          <TimeframeSwitch value={timeframe} onChange={setTimeframe} />
        </div>
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950 px-3 text-xs text-chalk-200 transition-colors duration-150 hover:border-ink-500 disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          {playing ? 'Воспроизведение…' : 'Воспроизвести'}
        </button>
      </div>

      <TradingChart
        className="h-[clamp(380px,62vh,620px)]"
        candles={scenario.candles}
        visibleCount={visible}
        timeframe={timeframe}
        annotations={annotations}
        markers={markers}
        segments={segments}
        editable={false}
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-800 px-4 py-3 text-xs text-chalk-400">
        <LegendItem color={CHART_COLORS.up} label="Вход и добавление" />
        <LegendItem color="#9b84ff" label="Сокращение и выход" dot />
        <LegendItem color={CHART_COLORS.stop} label="Стоп" dashed />
        {annotations.levels.length ? (
          <LegendItem color={CHART_COLORS.level} label="Твои уровни" />
        ) : null}
        {annotations.trendLine ? (
          <LegendItem color={CHART_COLORS.trend} label="Твоя трендовая линия" />
        ) : null}
      </div>
    </section>
  )
}

function LegendItem({
  color,
  label,
  dashed = false,
  dot = false,
}: {
  color: string
  label: string
  dashed?: boolean
  dot?: boolean
}) {
  return (
    <span className="flex items-center gap-2">
      {dot ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span
          className="w-4 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
        />
      )}
      {label}
    </span>
  )
}
