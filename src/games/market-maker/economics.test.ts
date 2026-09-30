import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marketMakerScenarios, MM_LOT_SIZE, MM_MAX_QUOTE_OFFSET_RATIO } from '@/data/marketMakerScenarios'
import { MarketMakerEngine } from './engine'

const fixture = vi.hoisted(() => ({ side: 'buy' as 'buy' | 'sell', size: 20 }))
vi.mock('./bots', () => ({
  INFORMED_LOOKAHEAD: 10,
  decideFlowOrder: (_regime: unknown, context: { tick: number }) =>
    context.tick === 1 ? { side: fixture.side, size: fixture.size } : null,
}))
vi.mock('./market', async (importOriginal) => ({
  ...await importOriginal<typeof import('./market')>(),
  buildMarketPaths: (_scenario: unknown, length: number) => ({
    marketPrice: Array.from({ length }, (_, tick) => tick <= 1 ? 100 : tick === 2 ? 100.8 : 101.2),
    fairValue: Array.from({ length }, (_, tick) => tick <= 1 ? 100 : 102),
  }),
}))

function engine() {
  return new MarketMakerEngine({
    ...marketMakerScenarios[0], durationSeconds: 2,
    flowPhases: [{ regime: 'informed', from: 0, to: 2, intensity: 1 }],
  })
}

beforeEach(() => { fixture.side = 'buy'; fixture.size = 20 })

describe('market maker economic invariants', () => {
  it('marks a final short of 20 lots at external final mark and freezes the finished round', () => {
    const game = engine()
    while (!game.finished) game.tick()
    const result = game.buildResult()
    expect(result.finalInventory).toBe(-20)
    expect(result.accounting!.markPrice).toBe(101.2)
    expect(result.realizedPnl).toBe(0)
    expect(result.unrealizedPnl).toBeCloseTo((100.4 - 101.2) * 20 * MM_LOT_SIZE)
    expect(result.pnl).toBeCloseTo(result.unrealizedPnl! - result.transactionCosts!)
    game.moveQuotes(1)
    game.narrowSpread()
    expect(game.hedge()).toBe(0)
    game.tick()
    expect(game.buildResult()).toEqual(result)
  })

  it('moving quotes cannot change mark or PnL; quotes stay ordered and within the market bound', () => {
    const game = engine()
    game.tick()
    const before = game.snapshot()
    for (const direction of [1, -1] as const) {
      for (let i = 0; i < 1000; i++) {
        game.moveQuotes(direction)
        if (i % 2) game.narrowSpread()
        else game.widenSpread()
        const state = game.snapshot()
        expect(state.bid).toBeLessThan(state.ask)
        expect(Math.abs((state.bid + state.ask) / 2 - state.marketPrice))
          .toBeLessThanOrEqual(state.marketPrice * MM_MAX_QUOTE_OFFSET_RATIO + 1e-9)
        expect(state.marketPrice).toBe(before.marketPrice)
        expect(state.pnl).toBe(before.pnl)
      }
    }
    const next = game.tick()
    expect(Math.abs((next.bid + next.ask) / 2 - next.marketPrice))
      .toBeLessThanOrEqual(next.marketPrice * MM_MAX_QUOTE_OFFSET_RATIO + 1e-9)
  })

  it('adverse selection creates actual short MTM losses, not just a markout label', () => {
    const game = engine()
    const fill = game.tick()
    const later = game.tick()
    expect(fill.trades[0].markout).toBeLessThan(0)
    expect(later.pnl - fill.pnl).toBeCloseTo(-20 * MM_LOT_SIZE * 0.8)
    expect(later.pnl).toBeLessThan(0)
    expect(later.accounting.openInventoryPnl).toBeCloseTo(-800)
  })

  it('settles a hedge at observable market, not hidden fair value, and removes further price exposure', () => {
    const game = engine()
    game.tick()
    const before = game.tick()
    game.hedge()
    const hedged = game.snapshot()
    expect(hedged.accounting.realizedPnl).toBeCloseTo(-800)
    expect(hedged.pnl).toBeCloseTo(before.pnl - before.hedgeCostPreview)
    expect(hedged.inventory).toBe(0)
    expect(game.tick().pnl).toBeCloseTo(hedged.pnl)
  })

  it('a long benefits from an external price increase', () => {
    fixture.side = 'sell'
    const game = engine()
    const before = game.tick()
    expect(game.tick().pnl - before.pnl).toBeCloseTo(20 * MM_LOT_SIZE * 0.8)
  })
})
