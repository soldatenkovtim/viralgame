import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { aggregateCandles, logicalToTime, timeToLogical, TIMEFRAMES } from './timeframes'

const scenario = blindMarketScenarios[0]
const checkpoint = scenario.checkpoints[0]

describe('aggregateCandles', () => {
  it('1ч собирается ровно из четырёх 15-минутных свечей', () => {
    const hourly = aggregateCandles(scenario.candles, checkpoint, 3600)
    const first = scenario.candles.slice(0, 4)

    expect(hourly).toHaveLength(checkpoint / 4)
    expect(hourly[0].open).toBe(first[0].open)
    expect(hourly[0].close).toBe(first[3].close)
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
    const forming = scenario.candles.slice(checkpoint, partial)

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
