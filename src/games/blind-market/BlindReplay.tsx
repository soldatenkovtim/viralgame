import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { CHART_COLORS, TradingChart } from '@/components/charts/TradingChart'
import { useReveal } from '@/hooks/useReveal'
import { formatPrice } from '@/lib/formatting'
import type { BlindMarketResult, BlindMarketScenario, ChartAnnotations } from '@/types/game'
import { formatPositionLabel } from './terminalFormatting'
import { TimeframeSwitch } from './ChartToolbar'
import { buildTradeTimeline } from './scoring'
import { formatCalendarTime, type TimeframeId } from './timeframes'
import { legSegments } from './tradeAnnotations'
import { positionEvents } from './positionAnalysis'
import { decisionTitle, replayMarkers } from './replayPresentation'

const EMPTY_ANNOTATIONS: ChartAnnotations = { levels: [], trendLine: null }

/**
 * Полный разбор сессии на том же рабочем графике: входы, изменения позиции,
 * стопы, выход и собственная разметка игрока. Можно проиграть заново.
 */
export function BlindReplay({
  scenario,
  result,
  selectedDecision = null,
  onPlayingChange,
  onSelectDecision,
}: {
  scenario: BlindMarketScenario
  result: BlindMarketResult
  selectedDecision?: number | null
  onPlayingChange?: (playing: boolean) => void
  onSelectDecision?: (index: number) => void
}) {
  const total = scenario.candles.length
  const [timeframe, setTimeframe] = useState<TimeframeId>(scenario.availableTimeframes.includes('1h') ? '1h' : scenario.baseTimeframe)
  const [playing, setPlaying] = useState(false)
  const { visible, revealTo, reset } = useReveal(total, 30, 3)

  const timeline = useMemo(
    () => buildTradeTimeline(scenario, result.decisions, visible - 1, true),
    [scenario, result.decisions, visible],
  )

  const markers = useMemo(
    () => replayMarkers(scenario, result.decisions, timeline.events, playing ? null : selectedDecision, visible),
    [scenario, result.decisions, timeline.events, selectedDecision, playing, visible],
  )
  const events = positionEvents(result.decisions, result.stopHits)
  const selected = selectedDecision !== null ? result.decisions[selectedDecision] : undefined
  const selectedCandle = selected ? scenario.candles[scenario.checkpoints[selected.checkpointIndex] - 1] : undefined

  const segments = useMemo(() => legSegments(scenario, timeline.legs), [scenario, timeline.legs])
  const annotations = result.annotations ?? EMPTY_ANNOTATIONS

  const play = () => {
    setPlaying(true)
    onPlayingChange?.(true)
    reset(scenario.checkpoints[0])
    revealTo(total, () => { setPlaying(false); onPlayingChange?.(false) })
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="text-sm text-chalk-200">Разбор сессии</h3>
          <TimeframeSwitch options={scenario.availableTimeframes} value={timeframe} onChange={setTimeframe} />
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

      <div className="blind-replay-navigation">
        <div className="blind-replay-points" role="group" aria-label="Точки торговых решений">
          {result.decisions.map((decision, index) => <button
            key={decision.checkpointIndex}
            type="button"
            aria-pressed={selectedDecision === index}
            aria-label={`Точка ${index + 1}: ${decisionTitle(events[index], decision.exposure)}`}
            disabled={playing}
            onClick={() => onSelectDecision?.(index)}
          >{String(index + 1).padStart(2, '0')} · {formatPositionLabel(decision.exposure)}</button>)}
        </div>
        <p className="blind-replay-detail" aria-live="polite" aria-atomic="true">
          {playing ? 'Воспроизведение сессии…' : selected && selectedCandle && selectedDecision !== null
            ? <><span>{formatCalendarTime(selectedCandle.time)} UTC</span>{' '}<span>{decisionTitle(events[selectedDecision], selected.exposure)}</span>{' '}<span>Цена: {formatPrice(selected.priceAtDecision)}</span></>
            : 'Выберите точку, чтобы выделить её на графике.'}
        </p>
      </div>

      <TradingChart
        className="h-[clamp(380px,62vh,620px)]"
        candles={scenario.candles}
        visibleCount={visible}
        timeframe={timeframe}
        annotations={annotations}
        markers={markers}
        segments={segments}
        focusCandleIndex={!playing && selected ? scenario.checkpoints[selected.checkpointIndex] - 1 : undefined}
        editable={false}
        showDates
      />

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-800 px-4 py-3 text-xs text-chalk-400">
        <LegendItem color={CHART_COLORS.up} label="Вход и добавление" />
        <LegendItem color="#9b84ff" label="Сокращение и выход" dot />
        <LegendItem color={CHART_COLORS.stop} label="Стоп" dashed />
        {timeline.events.some(event => event.kind === 'exit') && <LegendItem color="#9b84ff" label="Ф · Автозакрытие в конце сценария" dot />}
        {annotations.levels.length ? (
          <LegendItem color={CHART_COLORS.level} label="Ваши уровни" />
        ) : null}
        {annotations.trendLine ? (
          <LegendItem color={CHART_COLORS.trend} label="Ваша трендовая линия" />
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
