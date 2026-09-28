import { describe, expect, it } from 'vitest'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import type { MarketMakerScenario } from '@/types/game'
import { MarketMakerEngine } from './engine'
import { ticksFor } from './market'

const ROUNDS = 80
const CHECKPOINTS = [15, 30, 60] as const

type Checkpoint = (typeof CHECKPOINTS)[number]

interface RoundStats {
  maxInventoryBy: Record<Checkpoint, number>
  pnl: number
}

function playRound(scenario: MarketMakerScenario, active: boolean): RoundStats {
  const engine = new MarketMakerEngine(scenario)
  const checkpointTicks = CHECKPOINTS.map((seconds) => ticksFor(seconds))
  const maxInventoryBy = {} as Record<Checkpoint, number>
  let maxInventory = 0

  for (let tick = 1; tick <= engine.totalTicks; tick += 1) {
    const state = engine.tick()
    maxInventory = Math.max(maxInventory, Math.abs(state.inventory))
    checkpointTicks.forEach((checkpoint, index) => {
      if (tick === checkpoint) maxInventoryBy[CHECKPOINTS[index]] = maxInventory
    })

    if (active) {
      const mid = (state.bid + state.ask) / 2
      const target = state.marketPrice - state.inventory * 0.03
      if (target - mid > 0.06) engine.moveQuotes(1)
      if (mid - target > 0.06) engine.moveQuotes(-1)
      if (Math.abs(state.inventory) >= 15) engine.hedge()
    }
  }

  return { maxInventoryBy, pnl: engine.buildResult().pnl }
}

function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]
}

function simulate(base: MarketMakerScenario, active: boolean): RoundStats[] {
  return Array.from({ length: ROUNDS }, (_, index) =>
    playRound({ ...base, seed: base.seed + index * 7919 }, active),
  )
}

function summary(rounds: RoundStats[]) {
  const byCheckpoint = Object.fromEntries(
    CHECKPOINTS.map((seconds) => {
      const values = rounds.map((round) => round.maxInventoryBy[seconds])
      return [
        seconds,
        {
          median: percentile(values, 0.5),
          p75: percentile(values, 0.75),
          p95: percentile(values, 0.95),
        },
      ]
    }),
  ) as Record<Checkpoint, { median: number; p75: number; p95: number }>
  const pnl = percentile(
    rounds.map((round) => round.pnl),
    0.5,
  )
  return { byCheckpoint, pnl }
}

/**
 * Dev-тест сложности: пассивный игрок, который ничего не нажимает,
 * на ROUNDS seed-вариантах каждого сценария. Выводит median / p75 / p95
 * максимального |inventory| к 15, 30 и 60 секундам.
 */
describe('market maker difficulty', () => {
  it('пассивный игрок набирает позицию постепенно', () => {
    const lines: string[] = []
    const results = marketMakerScenarios.map((scenario) => ({
      scenario,
      passive: summary(simulate(scenario, false)),
      active: summary(simulate(scenario, true)),
    }))

    for (const { scenario, passive, active } of results) {
      lines.push(
        `${scenario.id.padEnd(20)} ` +
          CHECKPOINTS.map((seconds) => {
            const { median, p75, p95 } = passive.byCheckpoint[seconds]
            return `${seconds}с: ${median}/${p75}/${p95}`
          }).join('   ') +
          `   PnL пассивный ${Math.round(passive.pnl)} · активный ${Math.round(active.pnl)}`,
      )
    }

    console.log(
      `max |inventory| пассивного игрока, median/p75/p95, ${ROUNDS} seed на сценарий\n` +
        lines.join('\n'),
    )

    for (const { scenario, passive, active } of results) {
      if (scenario.id === 'mm_first_round') {
        expect(passive.byCheckpoint[15].median).toBeGreaterThanOrEqual(4)
        expect(passive.byCheckpoint[15].median).toBeLessThanOrEqual(13)
        expect(passive.byCheckpoint[30].median).toBeGreaterThanOrEqual(13)
        expect(passive.byCheckpoint[30].median).toBeLessThanOrEqual(27)
        expect(passive.byCheckpoint[60].median).toBeGreaterThanOrEqual(22)
        expect(passive.byCheckpoint[60].median).toBeLessThanOrEqual(48)
      }

      expect(active.pnl).toBeGreaterThan(passive.pnl)
    }
  })
})
