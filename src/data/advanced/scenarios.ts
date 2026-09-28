import { difficultyFor } from '@/modes/config'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import { crossArbitrageScenarios, crossArbitrageSessions } from '@/data/crossArbitrageScenarios'
import { marketShockScenarios } from '@/games/market-shock/scenarios'
import { createRandom } from '@/lib/random'
import type { BlindMarketScenario, MarketShockScenario, MarketMakerScenario, CrossArbitrageScenario, OhlcvCandle } from '@/types/game'

// Контрольные точки задают форму, шум и объёмы воспроизводятся по seed.
function path(seed: number, template: OhlcvCandle[], start: number, anchors: number[], volatility: number): OhlcvCandle[] {
  const rng = createRandom(seed)
  let previous = start
  return template.map((bar, i) => {
    const progress = i / Math.max(1, template.length - 1) * (anchors.length - 1)
    const segment = Math.min(anchors.length - 2, Math.floor(progress))
    const target = start * (1 + (anchors[segment] + (anchors[segment + 1] - anchors[segment]) * (progress - segment)) / 100)
    const close = target * (1 + rng.normal(0, volatility) / 100)
    const wick = Math.abs(rng.normal(0, volatility * 1.4)) * start / 100
    const open = previous
    previous = close
    return { time: bar.time, open, close, high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick, volume: Math.round(bar.volume * (0.65 + Math.abs(close - open) / (start * volatility / 100))) }
  })
}
const blindPatterns = [
  { name: 'Ложный пробой', points: [0, 1.2, 0.6, 2.1, -1.5, -0.2, -3.1] },
  { name: 'Ложный разворот', points: [0, -2, 0.8, -0.4, -3.8, -2.5, -5] },
  { name: 'Сжатие и вынос', points: [0, 0.2, -0.15, 0.12, -0.8, 3.2, 4.1] },
  { name: 'Продолжение тренда', points: [0, 2, 0.7, -0.6, 1.5, 3.7, 5] },
  { name: 'Сложный диапазон', points: [0, 1.4, -1.3, 1.8, -1.6, 0.9, 0.1] },
]
export const advancedBlindScenarios: BlindMarketScenario[] = blindPatterns.map((pattern, i) => {
  const base = blindMarketScenarios[i % blindMarketScenarios.length]
  const seed = 810001 + i
  const cut = base.checkpoints[0] - 96
  const history = path(seed, base.candles.slice(0, cut), base.candles[0].open, [0, 1, -1, 2, 0.5], 0.13)
  return { ...base, id: `advanced_blind_${i + 1}`, seed, mode: 'advanced', title: pattern.name,
    candles: [...history, ...path(seed + 1, base.candles.slice(cut), history.at(-1)!.close, pattern.points, 0.18)],
    asset: { name: 'Синтетический рынок', ticker: 'МОДЕЛЬ', exchange: 'Симуляция' },
    reveal: { title: pattern.name, description: 'Синтетический сценарий: первый импульс не определял итог. Важны размер позиции и реакция на последующие движения.' },
    info: { volume: 'Объём доступен на графике', volatility: 'Оцени диапазоны свечей', correlation: 'Данные недоступны', marketContext: 'Контекст скрыт', sector: 'Сектор скрыт' }, crowd: [] }
})
const shockPatterns = [
  { name: 'Ложный пробой вниз', pattern: 'false-breakdown' as const, points: [0, -3, -1, 1.5, 0.2, 3] },
  { name: 'V-разворот', pattern: 'v-reversal' as const, points: [0, -2, -5, -1, 2, 4] },
  { name: 'Двойной шок', pattern: 'second-leg' as const, points: [0, -4, -1, -6, -2, -7] },
  { name: 'Вторая волна', pattern: 'second-leg' as const, points: [0, -2, 0.5, -1, -4, -6] },
  { name: 'Шок ликвидности', pattern: 'liquidity-crisis' as const, points: [0, -5, 2, -4, 1, -2] },
  { name: 'Ложное восстановление', pattern: 'trend-collapse' as const, points: [0, -3, -1, 1.5, -2, -5] },
]
export const advancedShockScenarios: MarketShockScenario[] = shockPatterns.map((pattern, i) => {
  const base = marketShockScenarios[i % marketShockScenarios.length]
  const seed = 820001 + i
  const cut = base.initialVisibleIndex
  const future = path(seed, base.candles.slice(cut), base.candles[cut - 1].close, pattern.points, i === 4 ? 0.9 : 0.35)
  if (i === 4) {
    const gap = future[base.phaseCheckpoints[0] - cut]
    gap.open *= 0.98
    gap.low = Math.min(gap.low, gap.open)
  }
  const candles = [...base.candles.slice(0, cut), ...future]
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
  const range = (c: OhlcvCandle) => (c.high - c.low) / c.close
  const history = candles.slice(cut - 240, cut)
  const phases = base.phases.map((p, index) => {
    const start = index === 0 ? cut : base.phaseCheckpoints[index - 1]
    const end = base.phaseCheckpoints[index]
    const bars = candles.slice(start, end)
    return { ...p, marketDescription: '',
      priceChange: (candles[end - 1].close / candles[start - 1].close - 1) * 100,
      volatilityChange: Math.round((mean(bars.map(range)) / mean(history.map(range)) - 1) * 100),
      volumeMultiplier: mean(bars.map(c => c.volume)) / mean(history.map(c => c.volume)) }
  }) as MarketShockScenario['phases']
  return { ...base, id: `advanced_shock_${i + 1}`, mode: 'advanced', seed, pattern: pattern.pattern,
    candles, synthetic: true,
    revealAsset: 'Синтетический рынок', revealPeriod: 'Учебная симуляция', revealEvent: pattern.name,
    revealDescription: 'Первое движение не давало однозначного ответа. Сравни риск позиции с последующим развитием рынка.',
    phases }
})
export const advancedMakerScenarios: MarketMakerScenario[] = [0, 1, 2].map(i => ({
  ...marketMakerScenarios[0], id: `advanced_mm_${i + 1}`, mode: 'advanced', seed: 830001 + i,
  title: 'Переменный поток и волатильность', hedgeCostMultiplier: 1.2, softInventoryLimit: 12,
  inventoryCarryCost: 0.015,
  flowPhases: [
    { regime: 'noise', from: 0, to: 15, intensity: 0.9 },
    { regime: 'momentum', from: 15, to: 27, intensity: 0.85 },
    { regime: 'informed', from: 27, to: 40, intensity: 0.65 },
    { regime: 'noise', from: 40, to: 48, intensity: 1 },
    { regime: 'informed', from: 48, to: 60, intensity: 0.7 },
  ],
  fairValuePhases: [
    { regime: 'calm', from: 0, to: 15, strength: 0.7 },
    { regime: i === 1 ? 'drift-down' : 'drift-up', from: 15, to: 27, strength: 1.05 },
    { regime: 'volatile', from: 27, to: 40, strength: 1.2 },
    { regime: 'calm', from: 40, to: 48, strength: 0.8 },
    { regime: i === 1 ? 'drift-up' : 'drift-down', from: 48, to: 60, strength: 1.1 },
  ],
}))
export const advancedArbitrageScenarios: CrossArbitrageScenario[] = crossArbitrageScenarios.map((base, i) => {
  const reference = base.quotes[2]
  return { ...base, id: `advanced_${base.id}`, mode: 'advanced', seed: 840001 + i,
    durationSeconds: difficultyFor('cross-arbitrage', true).timerSeconds, dynamic: true, quoteStepMs: 1750,
    quotes: [...base.quotes, { ...reference, venueId: 'delta', venueName: 'Дельта',
      bid: reference.bid * 1.0004, ask: reference.ask * 1.0005, feeRate: 0.0007 },
      { ...reference, venueId: 'epsilon', venueName: 'Эпсилон', bid: reference.bid * 0.9995,
        ask: reference.ask * 0.9993, feeRate: 0.0004 }].map((q, j) => ({ ...q,
          venueName: ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон'][j],
          bidLiquidity: Math.min(q.bidLiquidity, 25 + j * 5), askLiquidity: Math.min(q.askLiquidity, 20 + j * 5),
          secondBid: q.bid * 0.9985, secondAsk: q.ask * 1.0015,
          secondBidLiquidity: 30, secondAskLiquidity: 30,
          thirdBid: q.bid * 0.992, thirdAsk: q.ask * 1.008,
          thirdBidLiquidity: 100, thirdAskLiquidity: 100,
        })),
    revealText: 'Сравни все маршруты: комиссии и глубина могут сделать меньший размер выгоднее. Котировки менялись каждые 1,75 секунды.' }
})
export const advancedArbitrageSessions = crossArbitrageSessions.map((s, i) => ({
  ...s, id: `advanced_${s.id}`, seed: 850001 + i, mode: 'advanced' as const,
  scenarioIds: s.scenarioIds.map(id => `advanced_${id}`),
  scenarios: s.scenarioIds.map(id => advancedArbitrageScenarios.find(scenario => scenario.id === `advanced_${id}`)!),
}))
