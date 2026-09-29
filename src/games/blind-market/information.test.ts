import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import benchmark from '@/scenarios/historical/benchmark-intraday.json'
import { buildBlindInformation, pearsonCorrelation } from './information'

it('calculates Pearson correlation from paired returns', () => {
  expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
  expect(pearsonCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
  expect(pearsonCorrelation([-1, 0, 1], [1, -2, 1])).toBeCloseTo(0)
})

describe.each(blindMarketScenarios)('$id pre-entry information', scenario => {
  const count = scenario.checkpoints[0]
  const cutoff = scenario.candles[count - 1].time
  it('provides four useful choices without disclosing the asset or historical period', () => {
    const { info } = scenario
    expect(info.volatility).toMatch(/Волатильность за 15 минут — [\d,]+%/)
    expect(info.correlation).toMatch(/С S&P 500: [−+][\d,]+/)
    expect(info.marketContext).toMatch(/Актив: [−+][\d,]+%/)
    expect(info.sector.length).toBeGreaterThan(30)
    const text = JSON.stringify(info)
    expect(text).not.toMatch(/недоступны|скрыт|Оцени|202[0-9]|будущ/i)
    expect(text).not.toContain(scenario.asset.ticker)
    expect(text).not.toContain(scenario.asset.name)
  })
  it('does not change any hint when all future asset and benchmark prices are replaced', () => {
    const changedCandles = scenario.candles.map((c, i) => i < count ? c : { ...c, open: 1, high: 999999, low: 1, close: 999999, volume: 999999 })
    const changedBenchmark = benchmark.map(c => c.time <= cutoff ? c : { ...c, close: 1 })
    expect(buildBlindInformation(changedCandles, count, changedBenchmark, scenario.info.sector, scenario.baseTimeframe)).toEqual(scenario.info)
    expect(buildBlindInformation(scenario.candles.slice(0, count), count, benchmark.filter(c => c.time <= cutoff), scenario.info.sector, scenario.baseTimeframe)).toEqual(scenario.info)
  })
  it('matches benchmark returns to the same dates, including crypto weekends', () => {
    const history = new Map(scenario.candles.slice(0, count).map(c => [c.time, c.close]))
    const pairs = benchmark.filter(c => c.time <= cutoff && history.has(c.time)).slice(-21)
    const assetReturns = pairs.slice(1).map((c, i) => history.get(c.time)! / history.get(pairs[i].time)! - 1)
    const benchmarkReturns = pairs.slice(1).map((c, i) => c.close / pairs[i].close - 1)
    const expected = Math.abs(pearsonCorrelation(assetReturns, benchmarkReturns)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(scenario.info.correlation).toContain(expected)
  })
})
