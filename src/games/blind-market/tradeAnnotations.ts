import { CHART_COLORS, type OverlaySegment } from '@/components/charts/TradingChart'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { exposureLabel } from '@/lib/formatting'
import type { BlindMarketScenario } from '@/types/game'
import type { TradeEvent, TradeLeg } from './scoring'
import { candleMidTime, getTimeframe } from './timeframes'

const CLOSE_COLOR = '#9b84ff'

export function tradeMarkers(events: TradeEvent[]): ChartMarker[] {
  return events.map((event) => {
    const sideColor = event.exposure > 0 ? CHART_COLORS.up : CHART_COLORS.down
    const long = event.exposure > 0

    switch (event.kind) {
      case 'open':
        return {
          candleIndex: event.candleIndex,
          position: long ? 'belowBar' : 'aboveBar',
          shape: long ? 'arrowUp' : 'arrowDown',
          color: sideColor,
          text: `Вход · ${exposureLabel(event.exposure)}`,
        }
      case 'increase':
        return {
          candleIndex: event.candleIndex,
          position: long ? 'belowBar' : 'aboveBar',
          shape: long ? 'arrowUp' : 'arrowDown',
          color: sideColor,
          text: `Добавил · ${exposureLabel(event.exposure)}`,
        }
      case 'reduce':
        return {
          candleIndex: event.candleIndex,
          position: long ? 'aboveBar' : 'belowBar',
          shape: 'circle',
          color: CLOSE_COLOR,
          text: `Сократил · ${exposureLabel(event.exposure)}`,
        }
      case 'flip':
        return {
          candleIndex: event.candleIndex,
          position: long ? 'belowBar' : 'aboveBar',
          shape: long ? 'arrowUp' : 'arrowDown',
          color: sideColor,
          text: `Переворот · ${exposureLabel(event.exposure)}`,
        }
      case 'close':
        return {
          candleIndex: event.candleIndex,
          position: 'aboveBar',
          shape: 'circle',
          color: CLOSE_COLOR,
          text: 'Закрыл',
        }
      case 'stop':
        return {
          candleIndex: event.candleIndex,
          position: 'aboveBar',
          shape: 'square',
          color: CHART_COLORS.stop,
          text: 'Стоп',
        }
      case 'exit':
        return {
          candleIndex: event.candleIndex,
          position: 'aboveBar',
          shape: 'circle',
          color: CLOSE_COLOR,
          text: 'Выход',
        }
    }
  })
}

/** Линии входа и стопа только на тех участках, где позиция реально была открыта. */
export function legSegments(scenario: BlindMarketScenario, legs: TradeLeg[]): OverlaySegment[] {
  const segments: OverlaySegment[] = []

  for (const leg of legs) {
    const from = candleMidTime(scenario.candles[leg.fromIndex], getTimeframe(scenario.baseTimeframe).seconds)
    const to = candleMidTime(scenario.candles[leg.toIndex], getTimeframe(scenario.baseTimeframe).seconds)
    const color = leg.exposure > 0 ? CHART_COLORS.up : CHART_COLORS.down

    segments.push({
      a: { time: from, price: leg.entryPrice },
      b: { time: to, price: leg.entryPrice },
      color,
    })

    if (leg.stopPrice !== null) {
      segments.push({
        a: { time: from, price: leg.stopPrice },
        b: { time: to, price: leg.stopPrice },
        color: CHART_COLORS.stop,
        dashed: true,
      })
    }
  }

  return segments
}
