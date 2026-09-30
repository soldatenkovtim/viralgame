import { describe, expect, it } from 'vitest'
import { createRandom } from '@/lib/random'
import { decideFlowOrder } from './bots'
import type { FlowRegime } from '@/types/game'

function sample(regime: FlowRegime, bid: number, ask: number, future = 100) {
  const random = createRandom(709123)
  const counts = { buy: 0, sell: 0, total: 0 }
  for (let i = 0; i < 20000; i++) {
    const order = decideFlowOrder(regime, {
      random, tick: 10, bid, ask, intensity: 1, imbalance: 0,
      marketPrice: Array(21).fill(100),
      fairValue: Array.from({ length: 21 }, (_, tick) => tick > 10 ? future : 100),
    })
    if (order) { counts[order.side]++; counts.total++ }
  }
  return counts
}

describe('flow economics', () => {
  it('narrow quotes get more fills, unattractive quotes nearly no fills', () => {
    const narrow = sample('noise', 99.9, 100.1)
    const wide = sample('noise', 99, 101)
    expect(narrow.total).toBeGreaterThan(wide.total * 5)
    expect(sample('noise', 98, 102).total).toBeLessThan(30)
    expect(sample('noise', 99.9, 100).buy).toBeGreaterThan(narrow.buy)
    expect(sample('noise', 100, 100.1).sell).toBeGreaterThan(narrow.sell)
  })

  it('informed flow anticipates price direction statistically, with wrong-side trades too', () => {
    for (const future of [99, 101]) {
      const fills = sample('informed', future - 0.1, future + 0.1, future)
      const correct = future > 100 ? fills.buy : fills.sell
      expect(correct / fills.total).toBeGreaterThan(0.80)
      expect(correct / fills.total).toBeLessThan(0.95)
    }
  })
})
