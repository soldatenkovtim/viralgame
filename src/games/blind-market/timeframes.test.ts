import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { aggregateCandles, logicalToTime, timeToLogical, TIMEFRAMES } from './timeframes'

const scenario = blindMarketScenarios[0]
const checkpoint = scenario.checkpoints[0]

describe('aggregateCandles', () => {
  it('недельная свеча сохраняет OHLC и сумму реального объёма', () => {
    const hourly = aggregateCandles(scenario.candles, checkpoint, 7 * 86400)
    const first = scenario.candles.filter(c => c.time < scenario.candles[0].time + 7 * 86400)

    expect(hourly.length).toBeLessThan(checkpoint)
    expect(hourly[0].open).toBe(first[0].open)
    expect(hourly[0].close).toBe(first.at(-1)!.close)
    expect(hourly[0].high).toBe(Math.max(...first.map((candle) => candle.high)))
    expect(hourly[0].low).toBe(Math.min(...first.map((candle) => candle.low)))
    expect(hourly[0].volume).toBe(first.reduce((sum, candle) => sum + candle.volume, 0))
  })

  it('на любом таймфрейме нет данных после точки решения', () => {
    const lastVisible = scenario.candles[checkpoint - 1]

    for (const timeframe of TIMEFRAMES) {
      const bars = aggregateCandles(scenario.candles, checkpoint, timeframe.seconds)
      const last = bars[bars.length - 1]
      expect(last.close).toBe(lastVisible.close)
      expect(last.time).toBeLessThanOrEqual(lastVisible.time)
    }
  })

  it('незавершённая старшая свеча строится только из раскрытых баз', () => {
    const partial = checkpoint + 10
    const daily = aggregateCandles(scenario.candles, partial, 86400)
    const forming = scenario.candles.slice(0, partial).filter(c => c.time >= daily.at(-1)!.time)

    expect(daily[daily.length - 1].close).toBe(forming[forming.length - 1].close)
    expect(daily[daily.length - 1].high).toBe(Math.max(...forming.map((candle) => candle.high)))
  })
})

describe('timeToLogical', () => {
  it('обратим к logicalToTime', () => {
    const origin = scenario.candles[0].time
    const time = origin + 12_345
    expect(logicalToTime(timeToLogical(time, origin, 900), origin, 900)).toBeCloseTo(time, 6)
  })
})

// Regression: Standard must retain the original minute/hour controls on real base data.
describe('Standard intraday timeframes', () => {
  it.each(blindMarketScenarios)('$id supports 15m / 1h / 4h / 1d from one 15-minute series', s => {
    expect(s.baseTimeframe).toBe('15m')
    expect(s.availableTimeframes).toEqual(['15m', '1h', '4h', '1d'])
    const first = s.candles.slice(0, 4)
    const hourly = aggregateCandles(s.candles, 4, 3600)
    expect(hourly).toHaveLength(1)
    expect(hourly[0]).toMatchObject({ open: first[0].open, close: first[3].close,
      high: Math.max(...first.map(c => c.high)), low: Math.min(...first.map(c => c.low)),
      volume: first.reduce((sum, c) => sum + c.volume, 0) })
    for (const seconds of [900, 3600, 14400, 86400]) {
      const bars = aggregateCandles(s.candles, s.checkpoints[0], seconds)
      expect(bars.at(-1)!.close).toBe(s.candles[s.checkpoints[0] - 1].close)
    }
  })
})
