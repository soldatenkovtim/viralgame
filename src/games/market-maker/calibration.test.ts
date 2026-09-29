import { describe, expect, it } from 'vitest'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import type { MarketMakerResult, MarketMakerScenario } from '@/types/game'
import { MarketMakerEngine } from './engine'

type Strategy = 'passive' | 'follower' | 'skewHedger' | 'hedgeSpam'

const SEEDS = 20

function run(scenario: MarketMakerScenario, strategy: Strategy): MarketMakerResult {
  const engine = new MarketMakerEngine(scenario)

  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    if (strategy === 'passive') continue

    const state = engine.snapshot()
    const mid = (state.bid + state.ask) / 2
    const skew = strategy === 'skewHedger' ? state.inventory * 0.03 : 0
    const target = state.marketPrice - skew
    if (target - mid > 0.06) engine.moveQuotes(1)
    if (mid - target > 0.06) engine.moveQuotes(-1)

    if (strategy === 'skewHedger' && Math.abs(state.inventory) >= 15) engine.hedge()
    if (strategy === 'hedgeSpam' && Math.abs(state.inventory) >= 3) engine.hedge()
  }

  return engine.buildResult()
}

/** Медиана метрики по SEEDS вариантам сценария. */
function median(
  scenario: MarketMakerScenario,
  strategy: Strategy,
  metric: (result: MarketMakerResult) => number,
): number {
  const values = Array.from({ length: SEEDS }, (_, index) =>
    metric(run({ ...scenario, seed: scenario.seed + index * 7919 }, strategy)),
  ).sort((a, b) => a - b)
  return values[Math.floor(SEEDS / 2)]
}

describe('market maker calibration', () => {
  it('каждая стратегия даёт сделки и score в диапазоне 0–100', () => {
    for (const scenario of marketMakerScenarios) {
      for (const strategy of ['passive', 'follower', 'skewHedger', 'hedgeSpam'] as Strategy[]) {
        const result = run(scenario, strategy)
        expect(result.tradeCount).toBeGreaterThan(0)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    }
  })

  it('управление inventory через сдвиг котировок и хедж — лучшая из простых стратегий', () => {
    for (const scenario of marketMakerScenarios) {
      const score = (strategy: Strategy) => median(scenario, strategy, (result) => result.score)
      const skew = score('skewHedger')
      expect(skew).toBeGreaterThan(score('passive') + (scenario.variant === 'noise-dominant' ? 5 : 20))
      // In noise flow, following price can match hedging without paying hedge fees.
      if (scenario.variant !== 'noise-dominant') expect(skew).toBeGreaterThan(score('follower'))
      expect(skew).toBeGreaterThan(score('hedgeSpam'))
    }
  })

  it('хедж после каждой сделки съедает заработанный спред', () => {
    for (const scenario of marketMakerScenarios) {
      const pnl = (strategy: Strategy) => median(scenario, strategy, (result) => result.pnl)
      expect(pnl('hedgeSpam')).toBeLessThan(pnl('skewHedger'))
    }
  })
})
