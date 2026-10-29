import type { ChartMarker } from '@/components/charts/CandleChart'
import type { BlindDecision, BlindMarketScenario } from '@/types/game'
import { positionEventLabels, type PositionEvent } from './positionAnalysis'
import type { TradeEvent } from './scoring'
import { formatPositionSize } from './terminalFormatting'
import { tradeMarkers } from './tradeAnnotations'

/** Display-only counts: automatic stops and final liquidation are not user decisions. */
export function positionChangeCount(events: readonly PositionEvent[]): number {
  return events.filter(event => event !== 'flat' && event !== 'hold' && event !== 'unknown').length
}

export function decisionTitle(event: PositionEvent, exposure: number): string {
  if (event === 'flat' || event === 'close' || event === 'unknown') return positionEventLabels[event]
  const side = exposure > 0 ? 'лонга' : 'шорта'
  const action = event === 'increase' ? `Увеличение ${side}`
    : event === 'reduce' ? `Сокращение ${side}`
    : event === 'hold' ? `Сохранение ${side}` : positionEventLabels[event]
  return `${action} · ${formatPositionSize(exposure)}`
}

/** Keep one numbered marker per decision, even when a stop shares its candle. */
export function replayMarkers(
  scenario: BlindMarketScenario,
  decisions: readonly BlindDecision[],
  events: TradeEvent[],
  selectedDecision: number | null,
  visibleCount: number,
): ChartMarker[] {
  const automatic = events.filter(event => event.kind === 'stop' || event.kind === 'exit')
  const markers = tradeMarkers(automatic).map((marker, index) => ({
    ...marker, text: automatic[index].kind === 'exit' ? 'Ф' : 'Стоп',
  }))
  decisions.forEach((decision, index) => {
    const candleIndex = scenario.checkpoints[decision.checkpointIndex] - 1
    if (!Number.isInteger(candleIndex) || candleIndex < 0 || candleIndex >= visibleCount) return
    const trade = events.find(event => event.candleIndex === candleIndex && event.kind !== 'stop' && event.kind !== 'exit')
    const marker: ChartMarker = trade ? tradeMarkers([trade])[0] : {
      candleIndex, position: 'aboveBar', shape: 'circle', color: '#6b6b78', text: '',
    }
    markers.push({ ...marker, text: String(index + 1).padStart(2, '0'),
      shape: selectedDecision === index ? 'square' : marker.shape })
  })
  return markers.sort((a, b) => a.candleIndex - b.candleIndex)
}
