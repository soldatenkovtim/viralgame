import sp500 from '@/scenarios/historical/shock-sp500-intraday.json'
import { legacyMarketShockScenarios } from './legacyScenarios'
import gold from '@/scenarios/historical/shock-gold-intraday.json'
import nvda from '@/scenarios/historical/shock-nvda-intraday.json'
import { metadata } from '@/scenario-engine/scenarioTypes'
import type { MarketShockScenario, OhlcvCandle, ShockPattern, ShockPreStructure } from '@/types/game'
export const SHOCK_VISIBLE_BARS = 60
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const range = (c: OhlcvCandle) => (c.high - c.low) / c.close
function build(id: string, asset: MarketShockScenario['asset'], candles: OhlcvCandle[], dates: [string, string, string, string], pattern: ShockPattern, preStructure: ShockPreStructure, event: string, description: string): MarketShockScenario {
  const at = (date: string) => candles.findIndex(c => new Date(c.time * 1000).toISOString().startsWith(date)) + 1
  const initialVisibleIndex = at(dates[0])
  const phaseCheckpoints = dates.slice(1).map(at) as [number, number, number]
  const history = candles.slice(0, initialVisibleIndex)
  const phases = phaseCheckpoints.map((end, i) => {
    const start = i === 0 ? initialVisibleIndex : phaseCheckpoints[i - 1]
    const bars = candles.slice(start, end)
    return { volatilityChange: Math.round((mean(bars.map(range)) / mean(history.map(range)) - 1) * 100),
      liquidityChange: 0, // OHLCV does not contain order-book liquidity; UI labels it unavailable.
      volumeMultiplier: mean(bars.map(c => c.volume)) / mean(history.map(c => c.volume)),
      priceChange: (candles[end - 1].close / candles[start - 1].close - 1) * 100,
      marketDescription: 'Сравни движение цены и объём с доступной историей.', availableActions: ['close', 'hedge', 'hold', 'increase'] }
  }) as MarketShockScenario['phases']
  const startTime = new Date(candles[0].time * 1000).toISOString()
  const endTime = new Date(candles.at(-1)!.time * 1000).toISOString()
  return { ...metadata('black-swan', pattern), id, seed: candles[0].time, asset, pattern, preStructure,
    assetHiddenName: 'Неизвестный рынок', revealAsset: `${asset.name} (${asset.ticker})`,
    revealPeriod: `${startTime.slice(0, 10)} — ${endTime.slice(0, 10)}`, revealEvent: event, revealDescription: description,
    synthetic: false, baseTimeframe: '15m', primaryTimeframe: '15m', contextTimeframe: '1h', availableTimeframes: ['15m', '1h', '4h', '1d'], candles,
    initialVisibleIndex, phaseCheckpoints, initialPosition: { direction: 'long', exposure: 0.6, entryPrice: candles[initialVisibleIndex - 1].close },
    context: { volatility: 'Оцени по графику', liquidity: 'нет данных стакана', volumeMultiplier: 1 },
    phases, crowd: [], startTime, endTime, internalTags: [pattern], sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(asset.ticker)}/history/` }
}
export const marketShockScenarios: MarketShockScenario[] = [
  build('shock-sp500-intraday-01', { ticker: '^GSPC', name: 'S&P 500', exchange: 'Индекс', assetClass: 'index' }, sp500,
    ["2026-09-22T16:45:00", "2026-09-22T18:45:00", "2026-09-23T14:15:00", "2026-09-23T16:15:00"], 'trend-collapse', 'uptrend', 'Снижение после локального максимума',
    'После подъёма индекс перешёл к снижению. Исторические 15-минутные свечи показывают продолжение движения после первого импульса; причина движения по OHLCV не устанавливается.'),
  build('shock-gold-intraday-01', { ticker: 'GC=F', name: 'Фьючерс на золото', exchange: 'COMEX · ряд Yahoo Finance', assetClass: 'commodity' }, gold,
    ["2026-09-15T04:45:00", "2026-09-15T06:45:00", "2026-09-15T08:45:00", "2026-09-15T10:45:00"], 'v-reversal', 'range', 'Внутридневная распродажа и восстановление золота',
    'Резкое снижение сменилось восстановлением. Показаны реальные 15-минутные свечи фьючерсного ряда поставщика без изменения цен и объёмов.'),
  build('shock-nvda-intraday-01', { ticker: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', assetClass: 'equity' }, nvda,
    ["2026-09-11T16:15:00", "2026-09-11T18:15:00", "2026-09-14T13:45:00", "2026-09-14T15:45:00"], 'second-leg', 'recovery', 'Гэп вниз после попытки восстановления',
    'После попытки восстановления акция открыла следующую сессию существенно ниже. Показаны реальные торговые сессии с сохранённым разрывом между ними; причина гэпа по OHLCV не устанавливается.'),
]
export function getMarketShockScenario(id?: string | null): MarketShockScenario { return [...marketShockScenarios, ...legacyMarketShockScenarios].find(s => s.id === id) ?? marketShockScenarios[0] }
