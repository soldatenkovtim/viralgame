import benchmark from '@/scenarios/historical/blind-benchmark.json'
import { buildBlindInformation } from '@/games/blind-market/information'
import aapl from '@/scenarios/historical/aapl.json'
import nvda from '@/scenarios/historical/nvda.json'
import btc from '@/scenarios/historical/btc.json'
import { metadata } from '@/scenario-engine/scenarioTypes'
import type { BlindMarketScenario, OhlcvCandle } from '@/types/game'

export const BLIND_BAR_SECONDS = 86400
function build(id: string, ticker: string, name: string, assetClass: 'equity' | 'crypto', candles: OhlcvCandle[], dates: string[], tag: string, sector: string): BlindMarketScenario {
  const checkpoints = dates.map(date => candles.findIndex(c => new Date(c.time * 1000).toISOString().startsWith(date)) + 1)
  const period = `${new Date(candles[0].time * 1000).toISOString().slice(0, 10)} — ${new Date(candles.at(-1)!.time * 1000).toISOString().slice(0, 10)}`
  return {
    ...metadata('blind-market', tag), id, seed: candles[0].time, title: tag,
    enabled: false, hiddenAssetLabel: 'Неизвестный рынок', startTime: new Date(candles[0].time * 1000).toISOString(),
    endTime: new Date(candles.at(-1)!.time * 1000).toISOString(), baseTimeframe: '1d', availableTimeframes: ['1d', '1w'],
    candles, checkpoints,
    asset: { ticker, name, assetClass, exchange: assetClass === 'crypto' ? 'USD · сводные данные' : 'NASDAQ' },
    reveal: { title: `Это был рынок ${name}`, period, description: 'Ты принимал решения на реальном историческом участке рынка. Цены и объёмы сохранены из исторического набора OHLCV.' },
    info: buildBlindInformation(candles, checkpoints[0], benchmark, sector),
    crowd: [], internalTags: [tag], sourceUrl: `https://finance.yahoo.com/quote/${ticker}/history/`,
  }
}
export const legacyBlindMarketScenarios: BlindMarketScenario[] = [
  build('blind-aapl-01', 'AAPL', 'Apple', 'equity', aapl, ['2023-06-02', '2023-06-16', '2023-07-07'], 'trend-continuation', 'Информационные технологии: потребительское оборудование и цифровые сервисы.'),
  build('blind-nvda-01', 'NVDA', 'NVIDIA', 'equity', nvda, ['2023-08-23', '2023-08-31', '2023-09-12'], 'false-breakout', 'Информационные технологии: полупроводники и вычислительное оборудование.'),
  build('blind-btc-01', 'BTC-USD', 'Bitcoin', 'crypto', btc, ['2023-03-08', '2023-03-11', '2023-03-17'], 'reversal', 'Цифровые активы: децентрализованные платёжные сети. Торговля идёт круглосуточно, включая выходные.'),
]
