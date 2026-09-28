import { describe, expect, it } from 'vitest'
import { CAPITAL } from '@/lib/constants'
import type { ShockAction } from '@/types/game'
import {
  applyShockAction,
  decisionsFromActions,
  HEDGE_COST_RATE,
  holdDecisions,
  simulateShock,
} from './engine'
import { marketShockScenarios, SHOCK_VISIBLE_BARS } from './scenarios'
import {
  buildMarketShockResult,
  marketShockInsights,
  marketShockScore,
  marketShockTraits,
} from './scoring'

const scenario = marketShockScenarios[0]

function run(actions: ShockAction[], source = scenario) {
  return buildMarketShockResult(source, decisionsFromActions(source, actions), [])
}

describe('applyShockAction', () => {
  it('меняет размер относительно текущей позиции', () => {
    expect(applyShockAction(0.6, 'close')).toBe(0)
    expect(applyShockAction(0.6, 'hedge')).toBeCloseTo(0.21, 6)
    expect(applyShockAction(0.6, 'hold')).toBe(0.6)
    expect(applyShockAction(0.6, 'increase')).toBeCloseTo(0.84, 6)
  })

  it('ограничивает увеличение максимальной экспозицией и сохраняет сторону', () => {
    expect(applyShockAction(0.84, 'increase')).toBe(1)
    expect(applyShockAction(-0.5, 'increase')).toBeCloseTo(-0.7, 6)
    expect(applyShockAction(-0.5, 'hedge')).toBeCloseTo(-0.18, 2)
  })
})

describe('структура сценариев', () => {
  it('покрывает пять паттернов с разной структурой до шока', () => {
    expect(new Set(marketShockScenarios.map((item) => item.pattern)).size).toBe(5)
    expect(new Set(marketShockScenarios.map((item) => item.preStructure)).size).toBe(5)
  })

  it.each(marketShockScenarios.map((item) => [item.id, item]))(
    '%s: история, фазы по 8–15 свечей и хвост после решений',
    (_, item) => {
      expect(item.initialVisibleIndex).toBeGreaterThanOrEqual(SHOCK_VISIBLE_BARS)
      let previous = item.initialVisibleIndex
      for (const checkpoint of item.phaseCheckpoints) {
        expect(checkpoint - previous).toBeGreaterThanOrEqual(8)
        expect(checkpoint - previous).toBeLessThanOrEqual(15)
        previous = checkpoint
      }
      expect(item.candles.length).toBeGreaterThan(item.phaseCheckpoints[2])
      expect(item.primaryTimeframe).not.toBe(item.contextTimeframe)
    },
  )

  it.each(marketShockScenarios.map((item) => [item.id, item]))(
    '%s: шок во второй фазе заметнее раннего сигнала',
    (_, item) => {
      const [early, shock] = item.phases
      expect(shock.volatilityChange).toBeGreaterThan(early.volatilityChange)
      expect(shock.volumeMultiplier).toBeGreaterThan(early.volumeMultiplier)
      expect(Math.abs(shock.priceChange)).toBeGreaterThan(Math.abs(early.priceChange))
    },
  )

  it('есть и продолжение, и разворот после шока', () => {
    const outcomes = marketShockScenarios.map((item) => {
      const hold = simulateShock(item, holdDecisions(item)).pnlPercent
      const closedEarly = run(['close', 'hold', 'hold'], item).pnlPercent
      return hold > closedEarly
    })
    expect(outcomes).toContain(true)
    expect(outcomes).toContain(false)
  })
})

describe('simulateShock', () => {
  it('после закрытия PnL больше не зависит от цены', () => {
    const result = simulateShock(scenario, decisionsFromActions(scenario, ['close', 'hold', 'hold']))
    const afterClose = result.points.filter((point) => point.index >= scenario.phaseCheckpoints[0] - 1)
    for (const point of afterClose) expect(point.pnl).toBeCloseTo(afterClose[0].pnl, 6)
  })

  it('после хеджа движения влияют только на остаток позиции', () => {
    const held = simulateShock(scenario, holdDecisions(scenario))
    const hedged = simulateShock(scenario, decisionsFromActions(scenario, ['hedge', 'hold', 'hold']))
    const at = scenario.phaseCheckpoints[0] - 1
    const heldMove = held.pnl - held.points.find((point) => point.index === at)!.pnl
    const hedgedMove =
      hedged.pnl - hedged.points.find((point) => point.index === at)!.pnl + CAPITAL * HEDGE_COST_RATE
    expect(hedgedMove / heldMove).toBeCloseTo(0.35, 1)
  })

  it('стоимость хеджа — 0,03% капитала', () => {
    const flat = { ...scenario, candles: scenario.candles.map((candle) => ({ ...candle, close: 100 })) }
    const flatScenario = { ...flat, initialPosition: { ...flat.initialPosition, entryPrice: 100 } }
    const result = simulateShock(flatScenario, decisionsFromActions(flatScenario, ['hedge', 'hold', 'hold']))
    expect(result.pnl).toBeCloseTo(-CAPITAL * HEDGE_COST_RATE, 6)
  })

  it('для шорта рост цены даёт убыток', () => {
    const short = marketShockScenarios.find((item) => item.initialPosition.direction === 'short')!
    const start = short.candles[short.initialVisibleIndex - 1].close
    const expected =
      ((-short.initialPosition.exposure * CAPITAL) / short.initialPosition.entryPrice) *
      (start - short.initialPosition.entryPrice)
    expect(simulateShock(short, [], short.initialVisibleIndex - 1).pnl).toBeCloseTo(expected, 4)
  })
})

describe('результат и score', () => {
  it('score собирается из четырёх компонент с весами 0,40 / 0,25 / 0,20 / 0,15', () => {
    const result = run(['hedge', 'hold', 'increase'])
    const breakdown = marketShockScore(result, scenario)
    const expected =
      breakdown.pnlScore * 0.4 +
      breakdown.drawdownControlScore * 0.25 +
      breakdown.exposureManagementScore * 0.2 +
      breakdown.adaptabilityScore * 0.15
    expect(breakdown.total).toBeCloseTo(expected, 6)
    expect(result.score).toBeCloseTo(expected, 6)
  })

  it('в продолжении распродажи ранняя защита даёт меньшую просадку', () => {
    const held = run(['hold', 'hold', 'hold'])
    const cut = run(['close', 'hold', 'hold'])
    expect(cut.maxDrawdown).toBeLessThan(held.maxDrawdown)
    expect(cut.score).toBeGreaterThan(held.score)
  })

  it('считает экспозицию и изменения позиции', () => {
    const result = run(['hedge', 'hold', 'increase'])
    expect(result.maxExposure).toBeCloseTo(0.6, 6)
    expect(result.minExposure).toBeCloseTo(0.21, 6)
    expect(result.positionChanges).toBe(2)
    expect(result.decisions.every((decision) => decision.pnlAfter !== undefined)).toBe(true)
  })

  it('таймауты снижают дисциплину', () => {
    const decisions = decisionsFromActions(scenario, ['hold', 'hold', 'hold'], 7000)
    const deliberate = buildMarketShockResult(scenario, decisions, [])
    const timedOut = buildMarketShockResult(
      scenario,
      decisions.map((decision) => ({ ...decision, timedOut: true, decisionTimeMs: 20000 })),
      [],
    )
    expect(marketShockTraits(timedOut, scenario).discipline).toBeLessThan(
      marketShockTraits(deliberate, scenario).discipline,
    )
  })
})

describe('marketShockInsights', () => {
  const FORBIDDEN = /правильн|ошиб|профессиональный трейдер/i
  const STRATEGIES: ShockAction[][] = [
    ['hold', 'hold', 'hold'],
    ['close', 'hold', 'hold'],
    ['hedge', 'hold', 'increase'],
    ['increase', 'increase', 'hold'],
    ['hold', 'close', 'hold'],
  ]

  it('даёт 1–2 нейтральных наблюдения', () => {
    for (const item of marketShockScenarios) {
      for (const actions of STRATEGIES) {
        const notes = marketShockInsights(run(actions, item), item)
        expect(notes.length).toBeGreaterThanOrEqual(1)
        expect(notes.length).toBeLessThanOrEqual(2)
        for (const note of notes) expect(note).not.toMatch(FORBIDDEN)
      }
    }
  })

  it('замечает сокращение после пробоя отмеченного уровня', () => {
    const decisions = decisionsFromActions(scenario, ['hold', 'hedge', 'hold'])
    const level = { id: 'l', price: (decisions[0].price + decisions[1].price) / 2 }
    const result = buildMarketShockResult(scenario, decisions, [level])
    expect(marketShockInsights(result, scenario)[0]).toMatch(/пробоя отмеченного уровня/)
  })
})


describe('полный выход завершает управление позицией', () => {
  it.each([1, 2, 3])('фиксирует выход в фазе %i для всех сценариев', (phase) => {
    for (const source of marketShockScenarios) {
      const actions: ShockAction[] = Array.from({ length: phase - 1 }, () => 'hedge')
      actions.push('close', 'increase', 'hold')
      const decisions = decisionsFromActions(source, actions)
      expect(decisions).toHaveLength(phase)
      const exit = decisions.at(-1)!
      const exitIndex = source.phaseCheckpoints[phase - 1] - 1
      expect(exit.price).toBe(source.candles[exitIndex].close)
      expect(exit.positionAfter).toBe(0)
      const result = buildMarketShockResult(source, decisions, [])
      expect(result.pnlPercent).toBeCloseTo(exit.pnlBefore, 10)
      expect(result.decisions.at(-1)!.pnlAfter).toBeCloseTo(exit.pnlBefore, 10)
      const after = simulateShock(source, decisions).points.filter((point) => point.index > exitIndex)
      expect(after.length).toBeGreaterThan(0)
      for (const point of after) {
        expect(point.exposure).toBe(0)
        expect(point.pnlPercent).toBeCloseTo(exit.pnlBefore, 10)
      }
      expect(marketShockInsights(result, source).join(' ')).toContain('прошёл без позиции')
    }
  })

  it('игнорирует попытку повторного входа после закрытия в расчёте', () => {
    const decisions = decisionsFromActions(scenario, ['close'])
    const closed = simulateShock(scenario, decisions)
    const invalid = { ...decisions[0], phase: 2, action: 'increase' as const, positionBefore: 0, positionAfter: 1 }
    expect(simulateShock(scenario, [...decisions, invalid]).pnl).toBe(closed.pnl)
  })
})
