import { difficultyFor } from '@/modes/config'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import { crossArbitrageScenarios, crossArbitrageSessions } from '@/data/crossArbitrageScenarios'
import { marketShockScenarios } from '@/games/market-shock/scenarios'
import type { BlindMarketScenario, MarketShockScenario, MarketMakerScenario, CrossArbitrageScenario } from '@/types/game'

// Advanced has its own IDs and decision timing; historical OHLCV is immutable in every mode.
export const advancedBlindScenarios: BlindMarketScenario[] = blindMarketScenarios.map((base, i) => ({
  ...base, id: `advanced-intraday-blind-${i + 1}`, mode: 'advanced', scoringProfile: 'blind-market-advanced-v1',
  checkpoints: base.checkpoints.map(c => c - 1),
}))
export const advancedShockScenarios: MarketShockScenario[] = marketShockScenarios.map((base, i) => ({
  ...base, id: `advanced-intraday-shock-${i + 1}`, mode: 'advanced', scoringProfile: 'black-swan-advanced-v1',
}))
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
