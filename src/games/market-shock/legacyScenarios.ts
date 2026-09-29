import sp500 from '@/scenarios/historical/sp500.json'
import gold from '@/scenarios/historical/gold.json'
import meta from '@/scenarios/historical/meta.json'
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
  return { ...metadata('black-swan', pattern), enabled: false, id, seed: candles[0].time, asset, pattern, preStructure,
    assetHiddenName: 'Неизвестный рынок', revealAsset: `${asset.name} (${asset.ticker})`,
    revealPeriod: `${startTime.slice(0, 10)} — ${endTime.slice(0, 10)}`, revealEvent: event, revealDescription: description,
    synthetic: false, baseTimeframe: '1d', primaryTimeframe: '1d', contextTimeframe: '1w', candles,
    initialVisibleIndex, phaseCheckpoints, initialPosition: { direction: 'long', exposure: 0.6, entryPrice: candles[initialVisibleIndex - 1].close },
    context: { volatility: 'Оцени по графику', liquidity: 'нет данных стакана', volumeMultiplier: 1 },
    phases, crowd: [], startTime, endTime, internalTags: [pattern], sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(asset.ticker)}/history/` }
}
export const legacyMarketShockScenarios: MarketShockScenario[] = [
  build('shock-sp500-covid', { ticker: '^GSPC', name: 'S&P 500', exchange: 'Индекс', assetClass: 'index' }, sp500,
    ['2020-02-14', '2020-02-21', '2020-03-09', '2020-03-16'], 'trend-collapse', 'uptrend', 'COVID sell-off',
    'В феврале–марте 2020 года распространение COVID-19 сопровождалось резкой распродажей акций. В этом историческом отрезке снижение продолжилось после промежуточных отскоков.'),
  build('shock-gold-2020', { ticker: 'GC=F', name: 'Фьючерс на золото', exchange: 'COMEX · ряд Yahoo Finance', assetClass: 'commodity' }, gold,
    ['2020-02-28', '2020-03-06', '2020-03-18', '2020-03-25'], 'v-reversal', 'range', 'Золото во время кризиса марта 2020',
    'В середине марта золото снижалось вместе с другими рынками, затем резко восстановилось. Здесь показан исторический фьючерсный ряд поставщика, включая переходы между контрактами.'),
  build('shock-meta-earnings', { ticker: 'META', name: 'Meta Platforms', exchange: 'NASDAQ · на тот момент FB', assetClass: 'equity' }, meta,
    ['2022-01-24', '2022-02-02', '2022-02-08', '2022-02-10'], 'second-leg', 'recovery', 'Отчёт Meta, февраль 2022',
    'После публикации квартальных результатов 2 февраля 2022 года акция открылась с крупным гэпом вниз. Короткое восстановление сменилось дальнейшим снижением.'),
]
export function getMarketShockScenario(id?: string | null): MarketShockScenario { return legacyMarketShockScenarios.find(s => s.id === id) ?? legacyMarketShockScenarios[0] }
