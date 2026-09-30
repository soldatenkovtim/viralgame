import { describe, expect, it } from 'vitest'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import type { MarketMakerResult, MarketMakerScenario } from '@/types/game'
import { MarketMakerEngine } from './engine'

type Strategy = 'passive' | 'follower' | 'skewHedger' | 'hedgeSpam' | 'narrow' | 'wide' | 'longOnly' | 'shortOnly'
const STRATEGIES: Strategy[] = ['passive', 'follower', 'skewHedger', 'hedgeSpam', 'narrow', 'wide', 'longOnly', 'shortOnly']

const SEEDS = 80

function run(scenario: MarketMakerScenario, strategy: Strategy): MarketMakerResult {
  const engine = new MarketMakerEngine(scenario)

  if (strategy === 'narrow' || strategy === 'wide') {
    for (let i = 0; i < 30; i++) {
      if (strategy === 'narrow') engine.narrowSpread()
      else engine.widenSpread()
    }
  }

  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    if (strategy === 'passive' || strategy === 'narrow' || strategy === 'wide') continue
    if (strategy === 'longOnly' || strategy === 'shortOnly') {
      for (let i = 0; i < 40; i++) engine.moveQuotes(strategy === 'longOnly' ? 1 : -1)
      continue
    }

    const state = engine.snapshot()
    const mid = (state.bid + state.ask) / 2
    const skew = strategy === 'skewHedger' ? state.inventory * 0.03 : 0
    const target = state.marketPrice - skew
    if (target - mid > 0.06) engine.moveQuotes(1)
    if (mid - target > 0.06) engine.moveQuotes(-1)

    if (strategy === 'skewHedger' && Math.abs(state.inventory) >= 15) engine.hedge()
    if (strategy === 'hedgeSpam' && state.inventory !== 0) engine.hedge()
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
  it('audits simple strategies across seeds', () => {
    for (const scenario of marketMakerScenarios) {
      const medians = {} as Record<Strategy, number>
      for (const strategy of STRATEGIES) {
        const rounds = Array.from({ length: SEEDS }, (_, index) => run({ ...scenario, seed: scenario.seed + index * 7919 }, strategy))
        const sorted = rounds.map(r => r.score).sort((a, b) => a - b)
        medians[strategy] = sorted[SEEDS / 2]
        console.log(`${scenario.id} ${strategy}: score median=${sorted[SEEDS / 2].toFixed(1)}, p95=${sorted[Math.floor(SEEDS * .95)].toFixed(1)}, mean PnL=${(rounds.reduce((s, r) => s + r.pnl, 0) / SEEDS).toFixed(0)}`)
        for (const round of rounds) {
          expect(Number.isFinite(round.pnl)).toBe(true)
          expect(round.score).toBeGreaterThanOrEqual(0)
          expect(round.score).toBeLessThanOrEqual(100)
        }
      }
      for (const strategy of ['passive', 'narrow', 'wide', 'hedgeSpam', 'longOnly', 'shortOnly'] as const) {
        expect(medians.skewHedger, `${scenario.id}: ${strategy}`).toBeGreaterThan(medians[strategy])
      }
    }
  })

  it('каждая стратегия даёт сделки и score в диапазоне 0–100', () => {
    for (const scenario of marketMakerScenarios) {
      for (const strategy of STRATEGIES) {
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
