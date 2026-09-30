import { describe, expect, it } from 'vitest'
import { MarketMakerAccount } from './accounting'

describe('Market maker cash and mark-to-market accounting (asset units)', () => {
  it.each([[100.80, -4], [100.30, 1]])('sell 10 @ 100.40, mark %s → PnL %s', (mark, expected) => {
    const account = new MarketMakerAccount()
    expect(account.totalPnl(100)).toBe(0)
    account.execute(-10, 100.40)
    expect(account.cash).toBeCloseTo(1004)
    expect(account.inventory).toBe(-10)
    expect(account.averageEntry).toBe(100.40)
    expect(account.totalPnl(mark)).toBeCloseTo(expected)
    expect(account.openInventoryPnl(mark)).toBeCloseTo(expected)
  })

  it('rising mark hurts shorts and helps longs regardless of initial capital', () => {
    for (const quantity of [-10, 10]) {
      const account = new MarketMakerAccount(5000)
      account.execute(quantity, 100.40)
      expect(account.totalPnl(100.80) - account.totalPnl(100.30)).toBeCloseTo(quantity * 0.5)
    }
  })

  it('tracks weighted entry, partial closes, reversals and flat positions', () => {
    const account = new MarketMakerAccount()
    account.execute(-10, 100)
    account.execute(-20, 103)
    expect(account.averageEntry).toBe(102)
    account.execute(5, 104)
    expect(account.averageEntry).toBe(102)
    account.execute(30, 101)
    expect(account.inventory).toBe(5)
    expect(account.averageEntry).toBe(101)
    account.execute(-5, 102)
    expect(account.averageEntry).toBeNull()
    expect(account.openInventoryPnl(200)).toBe(0)
    expect(account.totalPnl(200)).toBeCloseTo(20)
    expect(account.realizedPnl).toBeCloseTo(20)
  })

  it('buying is not realized spread; selling through zero realizes only the closed quantity', () => {
    const account = new MarketMakerAccount()
    account.execute(10, 100, 0.05)
    expect(account.realizedPnl).toBe(0)
    expect(account.openInventoryPnl(100.4)).toBeCloseTo(4)
    account.execute(-15, 101, 0.075)
    expect(account.realizedPnl).toBeCloseTo(10)
    expect(account.inventory).toBe(-5)
    expect(account.averageEntry).toBe(101)
    expect(account.totalPnl(102)).toBeCloseTo(10 - 5 - 0.125)
  })

  it('splitting executions cannot evade proportional transaction costs', () => {
    const whole = new MarketMakerAccount()
    const split = new MarketMakerAccount()
    whole.execute(10, 100, 0.05)
    whole.execute(-10, 101, 0.05)
    for (let i = 0; i < 10; i++) {
      split.execute(1, 100, 0.005)
      split.execute(-1, 101, 0.005)
    }
    expect(split.totalPnl(101)).toBeCloseTo(whole.totalPnl(101))
    expect(split.realizedPnl).toBeCloseTo(10)
    expect(split.transactionCosts).toBeCloseTo(0.1)
  })

  it('settles hedges at mark, preserves PnL and charges costs exactly once', () => {
    const account = new MarketMakerAccount(5000)
    account.execute(-10, 100.40)
    account.chargeCarry(2)
    const before = account.totalPnl(100.80)
    account.hedge(100.80, 3)
    expect(account.inventory).toBe(0)
    expect(account.averageEntry).toBeNull()
    expect(account.totalPnl(110)).toBeCloseTo(before - 3)
    expect(account.totalPnl(110)).toBeCloseTo(-9)
  })
})
