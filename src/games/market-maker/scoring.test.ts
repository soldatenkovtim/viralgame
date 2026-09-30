import { describe, expect, it } from 'vitest'
import {
  MM_HEDGE_COST_PER_UNIT,
  MM_HEDGE_TICKET_FEE,
  MM_INITIAL_SPREAD,
  MM_LOT_SIZE,
  MM_MAX_SPREAD,
  MM_MIN_SPREAD,
  MM_TRANSACTION_COST_PER_UNIT,
  marketMakerScenarios,
} from '@/data/marketMakerScenarios'
import type { MarketMakerResult } from '@/types/game'
import { MarketMakerEngine } from './engine'
import { buildMarketPaths } from './market'
import { marketMakerInsights, marketMakerScore, marketMakerScoreParts, marketMakerTraits } from './scoring'

const scenario = marketMakerScenarios[0]

function runRound(
  index: number,
  setup: (engine: MarketMakerEngine) => void = () => {},
  step: (engine: MarketMakerEngine) => void = () => {},
) {
  const engine = new MarketMakerEngine(marketMakerScenarios[index])
  setup(engine)
  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    step(engine)
  }
  return engine.buildResult()
}

/** Держит середину котировки у рыночной цены, не трогая спред. */
function followMarket(engine: MarketMakerEngine) {
  const state = engine.snapshot()
  const mid = (state.bid + state.ask) / 2
  if (state.marketPrice - mid > 0.06) engine.moveQuotes(1)
  if (mid - state.marketPrice > 0.06) engine.moveQuotes(-1)
}

function baseResult(overrides: Partial<MarketMakerResult> = {}): MarketMakerResult {
  return {
    scenarioId: 'mm_informed_rally',
    seed: 1,
    pnl: 1200,
    spreadPnl: 2400,
    inventoryPnl: -800,
    hedgeCosts: 400,
    maxInventory: 10,
    tradeCount: 28,
    averageSpread: 0.8,
    adverseSelectionLoss: 300,
    hedgeCount: 1,
    hedgedUnits: 12,
    finalInventory: 2,
    spreadChanges: 4,
    quoteMoves: 12,
    secondsAboveSoftLimit: 0,
    inventoryResponseSeconds: 2,
    spreadFirstHalf: 0.8,
    spreadSecondHalf: 0.8,
    spreadNoise: 0.8,
    spreadDirectional: 0.8,
    phases: [
      { regime: 'noise', from: 0, to: 22, fills: 10, averageSpread: 0.8, adverseSelectionLoss: 0, pnlChange: 600, averageQuoteLag: 0.1 },
      { regime: 'informed', from: 22, to: 42, fills: 10, averageSpread: 0.8, adverseSelectionLoss: 250, pnlChange: 200, averageQuoteLag: 0.4 },
      { regime: 'momentum', from: 42, to: 60, fills: 8, averageSpread: 0.8, adverseSelectionLoss: 50, pnlChange: 400, averageQuoteLag: 0.3 },
    ],
    score: 50,
    ...overrides,
  }
}

describe('рынок', () => {
  it('детерминирован по seed', () => {
    expect(buildMarketPaths(scenario, 80)).toEqual(buildMarketPaths(scenario, 80))
  })

  it('разные seed дают разные рынки', () => {
    const other = { ...scenario, seed: scenario.seed + 1 }
    expect(buildMarketPaths(scenario, 80).fairValue).not.toEqual(
      buildMarketPaths(other, 80).fairValue,
    )
  })

  it('начинается со справедливой цены 100', () => {
    const paths = buildMarketPaths(scenario, 10)
    expect(paths.fairValue[0]).toBe(100)
    expect(paths.marketPrice[0]).toBe(100)
  })

  it('справедливая и рыночная цена не зависят от действий игрока', () => {
    const passive = runRound(0)
    const active = runRound(0, (engine) => engine.narrowSpread(), (engine) => {
      followMarket(engine)
      if (Math.abs(engine.snapshot().inventory) > 6) engine.hedge()
    })

    const path = (result: MarketMakerResult) =>
      result.timeline!.map((point) => [point.fairValue, point.marketPrice])
    expect(path(active)).toEqual(path(passive))
  })

  it('рыночная цена движется и держится рядом со справедливой', () => {
    const { fairValue, marketPrice } = buildMarketPaths(scenario, 120)
    expect(new Set(marketPrice).size).toBeGreaterThan(40)
    const maxGap = Math.max(...marketPrice.map((price, i) => Math.abs(price - fairValue[i])))
    expect(maxGap).toBeLessThan(0.6)
  })
})

describe('MarketMakerEngine', () => {
  it('reconciles every tick and hedge against execution cash flows, including carry costs', () => {
    const config = { ...scenario, softInventoryLimit: 2, inventoryCarryCost: 0.01 }
    const engine = new MarketMakerEngine(config)
    let cash = 0
    let units = 0
    let fees = 0
    let tradeCount = 0
    let carry = 0
    let transactionCosts = 0
    engine.narrowSpread()
    const verify = () => {
      const state = engine.snapshot()
      expect(state.accounting.cash).toBeCloseTo(cash, 6)
      expect(state.inventory * MM_LOT_SIZE).toBe(units)
      expect(state.pnl).toBeCloseTo(cash + units * state.marketPrice - fees, 6)
      const result = engine.buildResult()
      expect(result.pnl).toBeCloseTo(result.spreadPnl + result.inventoryPnl - fees - carry - transactionCosts, 6)
      expect(result.pnl).toBeCloseTo(result.realizedPnl! + result.unrealizedPnl! - fees - carry - transactionCosts, 6)
    }
    while (!engine.finished) {
      const cost = Math.max(0, Math.abs(units) / MM_LOT_SIZE - 2) * 0.01 * MM_LOT_SIZE
      cash -= cost
      carry += cost
      const state = engine.tick()
      for (const trade of state.trades.slice(tradeCount)) {
        const quantity = (trade.botSide === 'buy' ? -1 : 1) * trade.size * MM_LOT_SIZE
        cash -= quantity * trade.price
        const transactionCost = Math.abs(quantity) * MM_TRANSACTION_COST_PER_UNIT
        cash -= transactionCost
        transactionCosts += transactionCost
        units += quantity
      }
      tradeCount = state.trades.length
      verify()
      if (!engine.finished && Math.abs(state.inventory) >= 10) {
        fees += state.hedgeCostPreview
        cash += units * state.marketPrice
        units = 0
        engine.hedge()
        verify()
      }
    }
    expect(tradeCount).toBeGreaterThan(0)
    expect(carry).toBeGreaterThan(0)
    expect(fees).toBeGreaterThan(0)
  })

  it('стартует с симметричной котировки вокруг 100', () => {
    const engine = new MarketMakerEngine(scenario)
    expect(engine.ask - engine.bid).toBeCloseTo(MM_INITIAL_SPREAD, 6)
    expect((engine.ask + engine.bid) / 2).toBeCloseTo(100, 6)
  })

  it('не показывает справедливую цену в снимке раунда', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < 10; i += 1) engine.tick()
    const snapshot = engine.snapshot()

    expect(snapshot).not.toHaveProperty('fairValue')
    expect(snapshot.history[0]).not.toHaveProperty('fairValue')
  })

  it('держит спред в допустимых границах', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < 40; i += 1) engine.narrowSpread()
    expect(engine.ask - engine.bid).toBeGreaterThanOrEqual(MM_MIN_SPREAD - 1e-9)
    for (let i = 0; i < 40; i += 1) engine.widenSpread()
    expect(engine.ask - engine.bid).toBeLessThanOrEqual(MM_MAX_SPREAD + 1e-9)
  })

  it('«Выше» сдвигает bid и ask на один шаг', () => {
    const engine = new MarketMakerEngine(scenario)
    const { bid, ask } = engine
    engine.moveQuotes(1)

    expect(engine.bid).toBeCloseTo(bid + 0.1, 6)
    expect(engine.ask).toBeCloseTo(ask + 0.1, 6)
  })

  it('узкий спред даёт больше сделок, широкий — меньше', () => {
    marketMakerScenarios.forEach((_, index) => {
      const base = runRound(index, undefined, followMarket).tradeCount
      const narrow = runRound(
        index,
        (engine) => {
          for (let i = 0; i < 5; i += 1) engine.narrowSpread()
        },
        followMarket,
      ).tradeCount
      const wide = runRound(
        index,
        (engine) => {
          for (let i = 0; i < 8; i += 1) engine.widenSpread()
        },
        followMarket,
      ).tradeCount

      expect(narrow).toBeGreaterThan(base)
      expect(wide).toBeLessThan(base)
    })
  })

  it('информированный поток создаёт adverse selection сильнее шумового', () => {
    const result = runRound(1, undefined, followMarket)
    const noise = result.phases.find((phase) => phase.regime === 'noise')!
    const informed = result.phases.find((phase) => phase.regime === 'informed')!

    expect(informed.adverseSelectionLoss).toBeGreaterThan(noise.adverseSelectionLoss)
  })

  it('PnL складывается из спреда, переоценки inventory и стоимости хеджа', () => {
    const result = runRound(1, undefined, (engine) => {
      followMarket(engine)
      if (Math.abs(engine.snapshot().inventory) >= 12) engine.hedge()
    })

    expect(result.pnl).toBeCloseTo(result.spreadPnl + result.inventoryPnl - result.hedgeCosts - (result.transactionCosts ?? 0), 6)
    expect(result.inventoryPnl).not.toBe(0)
  })

  it('inventory переоценивается по рыночной цене между сделками', () => {
    const engine = new MarketMakerEngine(scenario)
    let inventory = 0
    while (inventory === 0 && !engine.finished) inventory = engine.tick().inventory

    const pnl = engine.snapshot().pnl
    const price = engine.snapshot().marketPrice
    const tradesBefore = engine.snapshot().trades.length
    const next = engine.tick()
    if (next.trades.length === tradesBefore) {
      expect(next.pnl - pnl).toBeCloseTo(inventory * (next.marketPrice - price) * MM_LOT_SIZE, 6)
    }
  })

  it('хедж обнуляет inventory и стоит денег', () => {
    const engine = new MarketMakerEngine(scenario)
    while (engine.snapshot().inventory === 0) engine.tick()
    const inventory = engine.snapshot().inventory
    const pnlBefore = engine.snapshot().pnl

    expect(engine.hedge()).toBe(inventory)
    const expectedCost = Math.abs(inventory) * MM_HEDGE_COST_PER_UNIT * MM_LOT_SIZE + MM_HEDGE_TICKET_FEE
    expect(engine.snapshot().inventory).toBe(0)
    expect(pnlBefore - engine.snapshot().pnl).toBeCloseTo(expectedCost, 6)
  })

  it('меняет режим потока внутри раунда', () => {
    marketMakerScenarios.forEach((scenario, index) => {
      if (scenario.variant === 'noise-dominant') return
      const result = runRound(index)
      expect(new Set(result.phases.map((phase) => phase.regime)).size).toBeGreaterThanOrEqual(2)
      const regimes = new Set(result.trades!.map((trade) => trade.regime))
      expect(regimes.size).toBeGreaterThanOrEqual(2)
    })
  })

  it('заканчивает раунд за 60 секунд', () => {
    const engine = new MarketMakerEngine(scenario)
    for (let i = 0; i < engine.totalTicks; i += 1) engine.tick()

    expect(engine.finished).toBe(true)
    expect(engine.snapshot().secondsLeft).toBe(0)
    expect(engine.buildResult().timeline!.length).toBe(engine.totalTicks + 1)
  })

  it('воспроизводит тот же раунд при одинаковых действиях', () => {
    const first = runRound(2, undefined, followMarket)
    const second = runRound(2, undefined, followMarket)

    expect(second.pnl).toBeCloseTo(first.pnl, 9)
    expect(second.tradeCount).toBe(first.tradeCount)
  })
})

describe('marketMakerScore', () => {
  it('does not reward gross spread capture in a losing round', () => {
    const losing = baseResult({ pnl: -200, spreadPnl: 3000, inventoryPnl: -2800 })
    expect(marketMakerScoreParts(losing).spreadCapture).toBe(0)
  })

  it('does not award additional points for a lucky directional gain', () => {
    const flat = baseResult({ pnl: 800, inventoryPnl: 0 })
    const lucky = { ...flat, pnl: 10800, inventoryPnl: 10000 }
    expect(marketMakerScore(lucky)).toBe(marketMakerScore(flat))
  })

  it('does not grant a high score for sitting out with no fills', () => {
    expect(marketMakerScore(baseResult({ pnl: 0, tradeCount: 0, spreadPnl: 0, inventoryPnl: 0 }))).toBe(0)
  })

  it('остаётся в диапазоне 0–100', () => {
    expect(marketMakerScore(baseResult({ pnl: 99999, spreadPnl: 99999 }))).toBeLessThanOrEqual(100)
    expect(
      marketMakerScore(baseResult({ pnl: -99999, maxInventory: 200, secondsAboveSoftLimit: 60 })),
    ).toBeGreaterThanOrEqual(0)
  })

  it('при равном PnL крупный inventory снижает score', () => {
    const calm = marketMakerScore(baseResult())
    const risky = marketMakerScore(
      baseResult({ maxInventory: 40, secondsAboveSoftLimit: 30, finalInventory: 20 }),
    )
    expect(calm).toBeGreaterThan(risky + 15)
  })

  it('аккуратная работа обгоняет удачно пересиженную позицию', () => {
    const careful = runRound(1, undefined, (engine) => {
      const state = engine.snapshot()
      const mid = (state.bid + state.ask) / 2
      const target = state.marketPrice - state.inventory * 0.03
      if (target - mid > 0.06) engine.moveQuotes(1)
      if (mid - target > 0.06) engine.moveQuotes(-1)
      if (Math.abs(state.inventory) >= 15) engine.hedge()
    })
    const rider = runRound(1)

    expect(careful.score).toBeGreaterThan(rider.score)
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

  it('расширение спреда в направленном потоке повышает адаптивность', () => {
    const reactive = marketMakerTraits(baseResult({ spreadNoise: 0.6, spreadDirectional: 1.2 }))
    const passive = marketMakerTraits(baseResult({ spreadNoise: 0.6, spreadDirectional: 0.6 }))
    expect(reactive.adaptability).toBeGreaterThan(passive.adaptability)
  })
})

describe('marketMakerInsights', () => {
  it('даёт 1–2 нейтральных наблюдения', () => {
    const variants = [
      baseResult(),
      baseResult({ spreadNoise: 0.4, spreadDirectional: 0.4 }),
      baseResult({ hedgeCount: 6 }),
      baseResult({ maxInventory: 30, hedgeCount: 0, inventoryResponseSeconds: 12 }),
    ]
    for (const result of variants) {
      const insights = marketMakerInsights(result)
      expect(insights.length).toBeGreaterThanOrEqual(1)
      expect(insights.length).toBeLessThanOrEqual(2)
      for (const text of insights) {
        expect(text).not.toMatch(/неправильно|правильно|плох|хорош|ошибк/i)
      }
    }
  })

  it('замечает узкий спред в направленном потоке', () => {
    const insights = marketMakerInsights(baseResult({ spreadNoise: 0.4, spreadDirectional: 0.4 }))
    expect(insights[0]).toMatch(/узкий спред/)
  })
})
