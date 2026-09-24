import { describe, expect, it } from 'vitest'
import {
  MM_INITIAL_SPREAD,
  MM_MAX_SPREAD,
  MM_MIN_SPREAD,
  marketMakerScenarios,
} from '@/data/marketMakerScenarios'
import type { MarketMakerResult } from '@/types/game'
import { buildFairValuePath, MarketMakerEngine } from './engine'
import { marketMakerNarrative, marketMakerScore, marketMakerTraits } from './scoring'

const scenario = marketMakerScenarios[1]

function baseResult(overrides: Partial<MarketMakerResult> = {}): MarketMakerResult {
  return {
    scenarioId: 'mm_noise',
    seed: 1,
    botType: 'noise',
    pnl: 120,
    maxInventory: 6,
    tradeCount: 14,
    averageSpread: 0.8,
    adverseSelectionLoss: 40,
    grossEdge: 160,
    hedgeCount: 1,
    finalInventory: 2,
    spreadChanges: 4,
    quoteMoves: 6,
    spreadFirstHalf: 0.8,
    spreadSecondHalf: 0.8,
    score: 50,
    ...overrides,
  }
}

describe('buildFairValuePath', () => {
  it('детерминирован по seed', () => {
    const a = buildFairValuePath(4242, 100, 0.08, 50)
    const b = buildFairValuePath(4242, 100, 0.08, 50)
    expect(a).toEqual(b)
  })

  it('разные seed дают разные рынки', () => {
    const a = buildFairValuePath(1, 100, 0.08, 50)
    const b = buildFairValuePath(2, 100, 0.08, 50)
    expect(a).not.toEqual(b)
  })

  it('начинается с заданной справедливой цены', () => {
    expect(buildFairValuePath(7, 100, 0.05, 10)[0]).toBe(100)
  })
})

describe('MarketMakerEngine', () => {
  it('стартует с симметричной котировки вокруг справедливой цены', () => {
    const engine = new MarketMakerEngine(scenario)

    expect(engine.ask - engine.bid).toBeCloseTo(MM_INITIAL_SPREAD, 6)
    expect((engine.ask + engine.bid) / 2).toBeCloseTo(scenario.initialFairValue, 6)
  })

  it('не сужает спред ниже минимального', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < 40; i += 1) engine.narrowSpread()

    expect(engine.ask - engine.bid).toBeGreaterThanOrEqual(MM_MIN_SPREAD - 1e-9)
  })

  it('не расширяет спред выше максимального', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < 40; i += 1) engine.widenSpread()

    expect(engine.ask - engine.bid).toBeLessThanOrEqual(MM_MAX_SPREAD + 1e-9)
  })

  it('сдвигает обе стороны котировки на один шаг', () => {
    const engine = new MarketMakerEngine(scenario)
    const bid = engine.bid
    const ask = engine.ask

    engine.moveQuotes(1)

    expect(engine.bid - bid).toBeCloseTo(0.1, 6)
    expect(engine.ask - ask).toBeCloseTo(0.1, 6)
  })

  it('хедж обнуляет инвентарь', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < 40; i += 1) engine.tick()

    engine.hedge()
    expect(engine.snapshot().inventory).toBe(0)
  })

  it('заканчивает раунд ровно за заданное число тиков', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < engine.totalTicks; i += 1) engine.tick()

    expect(engine.finished).toBe(true)
    expect(engine.snapshot().secondsLeft).toBe(0)
  })

  it('воспроизводит тот же рынок при одинаковом seed и одинаковых действиях', () => {
    const run = () => {
      const engine = new MarketMakerEngine(scenario)
      for (let i = 0; i < engine.totalTicks; i += 1) engine.tick()
      return engine.buildResult()
    }

    const first = run()
    const second = run()

    expect(second.pnl).toBeCloseTo(first.pnl, 9)
    expect(second.tradeCount).toBe(first.tradeCount)
  })

  it('собирает согласованный результат раунда', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < engine.totalTicks; i += 1) engine.tick()

    const result = engine.buildResult()

    expect(result.botType).toBe(scenario.botType)
    expect(result.seed).toBe(scenario.seed)
    expect(result.maxInventory).toBeGreaterThanOrEqual(Math.abs(result.finalInventory))
    expect(result.adverseSelectionLoss).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('информированный поток создаёт adverse selection', () => {
    const engine = new MarketMakerEngine(marketMakerScenarios[1])
    for (let i = 0; i < engine.totalTicks; i += 1) engine.tick()

    const result = engine.buildResult()
    expect(result.tradeCount).toBeGreaterThan(0)
    expect(result.adverseSelectionLoss).toBeGreaterThan(0)
  })
})

describe('marketMakerScore', () => {
  it('остаётся в диапазоне 0–100', () => {
    expect(marketMakerScore(baseResult({ pnl: 99999 }))).toBeLessThanOrEqual(100)
    expect(marketMakerScore(baseResult({ pnl: -99999, maxInventory: 200 }))).toBeGreaterThanOrEqual(0)
  })

  it('при равном PnL меньший инвентарь даёт больший score', () => {
    expect(marketMakerScore(baseResult({ maxInventory: 4 }))).toBeGreaterThan(
      marketMakerScore(baseResult({ maxInventory: 24 })),
    )
  })
})

describe('marketMakerTraits', () => {
  it('никогда не выходит за 0–100', () => {
    const traits = marketMakerTraits(baseResult({ pnl: -5000, maxInventory: 80 }))
    for (const value of Object.values(traits)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('против токсичного потока расширение спреда повышает адаптивность', () => {
    const reactive = marketMakerTraits(
      baseResult({ botType: 'informed', spreadFirstHalf: 0.6, spreadSecondHalf: 1.2 }),
    )
    const passive = marketMakerTraits(
      baseResult({ botType: 'informed', spreadFirstHalf: 0.6, spreadSecondHalf: 0.6 }),
    )

    expect(reactive.adaptability).toBeGreaterThan(passive.adaptability)
  })
})

describe('marketMakerNarrative', () => {
  it('описывает сессию и не оценивает игрока', () => {
    const text = marketMakerNarrative(
      baseResult({ botType: 'informed', spreadFirstHalf: 0.6, spreadSecondHalf: 0.6 }),
    )

    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/неправильно|плохо|ошибк/i)
  })
})
