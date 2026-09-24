import { describe, expect, it } from 'vitest'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import { MarketMakerEngine } from './engine'

type Strategy = 'passive' | 'hedger' | 'widener'

function run(scenarioIndex: number, strategy: Strategy) {
  const engine = new MarketMakerEngine(marketMakerScenarios[scenarioIndex])

  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    const state = engine.snapshot()

    if (strategy === 'hedger' && Math.abs(state.inventory) >= 8) engine.hedge()

    if (strategy === 'widener') {
      if (Math.abs(state.inventory) >= 6) engine.widenSpread()
      if (Math.abs(state.inventory) <= 2) engine.narrowSpread()
      if (state.inventory >= 5) engine.moveQuotes(-1)
      if (state.inventory <= -5) engine.moveQuotes(1)
    }
  }

  return engine.buildResult()
}

describe('market maker calibration', () => {
  it('каждый бот даёт сделки и score в диапазоне 0–100', () => {
    marketMakerScenarios.forEach((scenario, index) => {
      ;(['passive', 'hedger', 'widener'] as Strategy[]).forEach((strategy) => {
        const result = run(index, strategy)
        expect(result.tradeCount).toBeGreaterThan(0)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
        expect(result.botType).toBe(scenario.botType)
      })
    })
  })
})
