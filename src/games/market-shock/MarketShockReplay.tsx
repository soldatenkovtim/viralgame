import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { CHART_COLORS } from '@/components/charts/TradingChart'
import { useReveal } from '@/hooks/useReveal'
import { formatPercent, formatPrice } from '@/lib/formatting'
import type { MarketShockResult, MarketShockScenario } from '@/types/game'
import { actionLabels, decisionCandleIndex, initialExposure, positionLabel } from './engine'
import { MarketShockChart } from './MarketShockChart'
import { decisionPosition, exposureSegments } from './resultPresentation'

export function MarketShockReplay({ scenario, result, selectedDecision = null, onSelectDecision, onPlayingChange }: {
  scenario: MarketShockScenario
  result: MarketShockResult
  selectedDecision?: number | null
  onSelectDecision?: (index: number) => void
  onPlayingChange?: (playing: boolean) => void
}) {
  const total = scenario.candles.length
  const [playing, setPlaying] = useState(false)
  const { visible, revealTo, reset } = useReveal(total, 40, 1)
  const exit = result.decisions.find(d => d.positionAfter === 0)
  const exitTime = exit ? scenario.candles[decisionCandleIndex(scenario, exit.phase)].time : undefined
  const startIndex = scenario.initialVisibleIndex - 1
  const selected = !playing && selectedDecision !== null ? result.decisions[selectedDecision] : undefined
  const selectedIndex = selected ? decisionCandleIndex(scenario, selected.phase) : undefined

  const markers = useMemo<ChartMarker[]>(() => [
    { candleIndex: startIndex, position: 'belowBar', shape: 'square', color: CHART_COLORS.entry, text: 'Старт' },
    ...result.decisions.map((decision, index): ChartMarker => ({
      id: `decision-${index}`,
      candleIndex: decisionCandleIndex(scenario, decision.phase),
      position: 'aboveBar', shape: selectedDecision === index && !playing ? 'square' : 'circle',
      color: selectedDecision === index && !playing ? '#c4a7ef' : '#9982b5',
      text: String(decision.phase).padStart(2, '0'),
    })),
    ...(result.maxDrawdown >= 0.1 ? [{ candleIndex: result.maxDrawdownIndex, position: 'belowBar' as const, shape: 'arrowUp' as const, color: CHART_COLORS.down, text: 'DD' }] : []),
    ...(result.maxPnlIndex > startIndex ? [{ candleIndex: result.maxPnlIndex, position: 'belowBar' as const, shape: 'arrowDown' as const, color: CHART_COLORS.up, text: 'PnL' }] : []),
  ], [result, scenario, startIndex, selectedDecision, playing])

  const play = () => {
    setPlaying(true)
    onPlayingChange?.(true)
    reset(scenario.initialVisibleIndex)
    revealTo(total, () => { setPlaying(false); onPlayingChange?.(false) })
  }
  const selectMarker = (id: string) => {
    if (playing) return
    const index = result.decisions.findIndex((_, index) => id === `decision-${index}`)
    if (index >= 0) onSelectDecision?.(index)
  }
  const selectedTime = selectedIndex === undefined ? undefined : scenario.candles[selectedIndex].time

  return <div>
    <div className="blind-replay-navigation">
      <div className="blind-replay-points" role="group" aria-label="Точки решений">
        {result.decisions.map((decision, index) => <button type="button" key={decision.phase} aria-pressed={selectedDecision === index && !playing} disabled={playing} onClick={() => onSelectDecision?.(index)}>Точка {String(decision.phase).padStart(2, '0')}</button>)}
      </div>
      <div className="blind-replay-detail" aria-live="polite">
        {playing ? 'Воспроизведение сессии…' : selected && selectedTime !== undefined
          ? <><span>{new Date(selectedTime * 1000).toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC</span><span>{selected.timedOut ? 'Без подтверждения по таймеру' : actionLabels[selected.action]} · {decisionPosition(selected)}</span><span>Цена {formatPrice(selected.price)} · PnL {formatPercent(selected.pnlBefore)}</span></>
          : 'Выберите точку, чтобы увидеть действие, цену, экспозицию и PnL в момент решения.'}
      </div>
    </div>
    <MarketShockChart scenario={scenario} visibleCount={visible} position={initialExposure(scenario)} levels={result.levels} markers={markers} mutedAfter={exitTime} editable={false} showDates focusCandleIndex={selectedIndex} onMarkerSelect={selectMarker} className="h-[clamp(380px,55vh,540px)]"
      toolbarExtra={<button type="button" onClick={play} disabled={playing} className="flex h-8 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950 px-3 text-xs text-chalk-200 hover:border-ink-500 disabled:opacity-40"><Play className="h-3.5 w-3.5" aria-hidden />{playing ? 'Воспроизведение…' : 'Воспроизвести'}</button>} />
    <div className="shock-replay-extremes"><span>DD · максимальная просадка {formatPercent(-result.maxDrawdown)}</span><span>PnL · максимум {formatPercent(result.maxPnlPercent)}</span><span>ENTRY · средняя цена входа</span>{result.levels.length > 0 && <span>Горизонтальные линии · ваши уровни</span>}</div>
    {exit && <p className="mt-2 text-xs text-chalk-400">Полный выход по {formatPrice(exit.price)}. Серые свечи показывают рынок после закрытия позиции.</p>}
    <ExposureStrip scenario={scenario} result={result} selectedIndex={selectedIndex} />
  </div>
}

function ExposureStrip({ scenario, result, selectedIndex }: {
  scenario: MarketShockScenario
  result: MarketShockResult
  selectedIndex?: number
}) {
  const segments = exposureSegments(scenario, result)
  const span = scenario.candles.length - scenario.initialVisibleIndex
  const active = selectedIndex === undefined ? undefined : segments.findLast(segment => segment.from <= selectedIndex)
  return <div className="shock-exposure">
    <p>Экспозиция по ходу сценария</p>
    <div className="shock-exposure-track" aria-hidden>
      {segments.map((segment, index) => <div key={index} className={`shock-exposure-segment ${segment === active ? 'is-selected' : ''}`} style={{ width: `${((segment.to - segment.from) / span) * 100}%` }} title={positionLabel(segment.exposure)}><div className="shock-exposure-fill" style={{ height: `${Math.abs(segment.exposure) * 100}%` }} /></div>)}
    </div>
    <ol className="shock-exposure-labels" aria-label="Изменения чистой экспозиции">
      {segments.map((segment, index) => <li key={index} className={segment === active ? 'is-selected' : undefined}>{index > 0 && <span aria-hidden>→ </span>}{positionLabel(segment.exposure)}</li>)}
    </ol>
  </div>
}
