import type { TimeframeId } from './timeframes'
import type { BlindMarketScenario, OhlcvCandle } from '@/types/game'

const WINDOW = 20
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const returns = (prices: number[]) => prices.slice(1).map((price, i) => price / prices[i] - 1)
const number = (value: number, digits = 1) => value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const signedPercent = (value: number) => `${value >= 0 ? '+' : '−'}${number(Math.abs(value) * 100)}%`

export function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) throw new Error('Correlation requires aligned observations')
  const aMean = mean(a), bMean = mean(b)
  let covariance = 0, aVariance = 0, bVariance = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - aMean, y = b[i] - bMean
    covariance += x * y; aVariance += x * x; bVariance += y * y
  }
  if (!aVariance || !bVariance) throw new Error('Correlation requires nonconstant returns')
  return Math.max(-1, Math.min(1, covariance / Math.sqrt(aVariance * bVariance)))
}

/** Hints are a frozen pre-entry snapshot, never a summary of the scenario's future. */
export function buildBlindInformation(candles: OhlcvCandle[], visibleCount: number, benchmark: OhlcvCandle[], sector: string, timeframe: TimeframeId = '1d'): BlindMarketScenario['info'] {
  const barLabel = timeframe === '15m' ? '15-минутных' : 'дневных'
  const barDative = timeframe === '15m' ? '15-минутным' : 'дневным'
  const volatilityLabel = timeframe === '15m' ? 'Волатильность за 15 минут' : 'Дневная волатильность'
  const history = candles.slice(0, visibleCount)
  if (history.length < WINDOW + 1) throw new Error('Insufficient history for blind-market hints')
  const cutoff = history.at(-1)!.time
  const recent = history.slice(-WINDOW)
  const dailyReturns = returns(history.slice(-(WINDOW + 1)).map(c => c.close))
  const averageReturn = mean(dailyReturns)
  const dailyVolatility = Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - averageReturn) ** 2, 0) / (dailyReturns.length - 1))
  const averageRange = mean(recent.map(c => (c.high - c.low) / c.open))

  // Match dates first, then calculate both returns over exactly the same intervals.
  // This also handles weekends in crypto without pairing a one-day and three-day return.
  const byDate = new Map(history.map(c => [c.time, c.close]))
  const paired = benchmark.filter(c => c.time <= cutoff && byDate.has(c.time)).slice(-(WINDOW + 1))
  if (paired.length !== WINDOW + 1) throw new Error('Insufficient aligned benchmark history')
  const correlation = pearsonCorrelation(returns(paired.map(c => byDate.get(c.time)!)), returns(paired.map(c => c.close)))
  const strength = Math.abs(correlation) >= 0.7 ? 'сильная' : Math.abs(correlation) >= 0.3 ? 'умеренная' : 'слабая'
  const relationship = Math.abs(correlation) < 0.3 ? 'Связь слабая: движения часто расходились.' : correlation > 0
    ? 'Доходности чаще двигались в одном направлении.' : 'Доходности чаще двигались в противоположных направлениях.'
  const marketReturn = paired.at(-1)!.close / paired[0].close - 1
  const assetReturn = history.at(-1)!.close / history.at(-(WINDOW + 1))!.close - 1
  const averagePrice = mean(recent.map(c => c.close))
  const distanceToAverage = history.at(-1)!.close / averagePrice - 1
  const volumeRatio = mean(recent.slice(-5).map(c => c.volume)) / mean(recent.map(c => c.volume))

  return {
    volume: `Средний объём последних 5 свечей — ${number(volumeRatio)}× среднего за 20 свечей.`,
    volatility: `${volatilityLabel} — ${number(dailyVolatility * 100)}%. Средний диапазон свечи — ${number(averageRange * 100)}%. Расчёт по последним 20 завершённым ${barDative} свечам.`,
    correlation: `С S&P 500: ${correlation >= 0 ? '+' : '−'}${number(Math.abs(correlation), 2)} — ${strength}. ${relationship} По доходностям за 20 общих торговых интервалов.`,
    marketContext: `S&P 500: ${signedPercent(marketReturn)} за 20 торговых интервалов. Актив: ${signedPercent(assetReturn)} за 20 ${barLabel} свечей; цена ${distanceToAverage >= 0 ? 'выше' : 'ниже'} средней за 20 свечей на ${number(Math.abs(distanceToAverage) * 100)}%. Объём последних 5 свечей — ${number(volumeRatio)}× среднего.`,
    sector,
  }
}
