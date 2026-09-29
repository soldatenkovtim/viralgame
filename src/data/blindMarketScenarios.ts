import { legacyBlindMarketScenarios } from './legacyBlindMarketScenarios'
import benchmark from '@/scenarios/historical/benchmark-intraday.json'
import { buildBlindInformation } from '@/games/blind-market/information'
import aapl from '@/scenarios/historical/aapl-intraday.json'
import nvda from '@/scenarios/historical/nvda-intraday.json'
import btc from '@/scenarios/historical/btc-intraday.json'
import { metadata } from '@/scenario-engine/scenarioTypes'
import type { BlindMarketScenario, OhlcvCandle } from '@/types/game'

export const BLIND_BAR_SECONDS = 900
function build(id: string, ticker: string, name: string, assetClass: 'equity' | 'crypto', candles: OhlcvCandle[], dates: string[], tag: string, sector: string): BlindMarketScenario {
  const checkpoints = dates.map(date => candles.findIndex(c => new Date(c.time * 1000).toISOString().startsWith(date)) + 1)
  const period = `${new Date(candles[0].time * 1000).toISOString().slice(0, 10)} — ${new Date(candles.at(-1)!.time * 1000).toISOString().slice(0, 10)}`
  return {
    ...metadata('blind-market', tag), id, seed: candles[0].time, title: tag,
    hiddenAssetLabel: 'Неизвестный рынок', startTime: new Date(candles[0].time * 1000).toISOString(),
    endTime: new Date(candles.at(-1)!.time * 1000).toISOString(), baseTimeframe: '15m', availableTimeframes: ['15m', '1h', '4h', '1d'],
    candles, checkpoints,
    asset: { ticker, name, assetClass, exchange: assetClass === 'crypto' ? 'USD · сводные данные' : 'NASDAQ' },
    reveal: { title: `Это был рынок ${name}`, period, description: 'Ты принимал решения на реальном историческом участке рынка. Цены и объёмы сохранены из исторического набора OHLCV.' },
    info: buildBlindInformation(candles, checkpoints[0], benchmark, sector, '15m'),
    crowd: [], internalTags: [tag], sourceUrl: `https://finance.yahoo.com/quote/${ticker}/history/`,
  }
}
export const blindMarketScenarios: BlindMarketScenario[] = [
  build('blind-aapl-intraday-01', 'AAPL', 'Apple', 'equity', aapl, ['2026-09-10T19:45', '2026-09-11T19:45', '2026-09-16T19:45'], 'trend-continuation', 'Информационные технологии: потребительское оборудование и цифровые сервисы.'),
  build('blind-nvda-intraday-01', 'NVDA', 'NVIDIA', 'equity', nvda, ['2026-09-22T19:45', '2026-09-23T19:45', '2026-09-24T19:45'], 'false-breakout', 'Информационные технологии: полупроводники и вычислительное оборудование.'),
  build('blind-btc-intraday-01', 'BTC-USD', 'Bitcoin', 'crypto', btc, ['2026-09-15T19:45', '2026-09-16T19:45', '2026-09-18T19:45'], 'reversal', 'Цифровые активы: децентрализованные платёжные сети. Торговля идёт круглосуточно, включая выходные.'),
]
export function getBlindScenario(id?: string | null): BlindMarketScenario {
  return [...blindMarketScenarios, ...legacyBlindMarketScenarios].find(s => s.id === id) ?? blindMarketScenarios[0]
}
