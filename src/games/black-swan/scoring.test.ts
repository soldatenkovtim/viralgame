import { describe, expect, it } from 'vitest'
import { blackSwanScenarios } from '@/data/blackSwanScenarios'
import { CAPITAL } from '@/lib/constants'
import type { BlackSwanAction, BlackSwanDecision, BlackSwanScenario } from '@/types/game'
import { buildShockPath } from './path'
import {
  applyBlackSwanAction,
  blackSwanScore,
  blackSwanTraits,
  computeBlackSwan,
  computeRevealedPnl,
} from './scoring'

const scenario: BlackSwanScenario = blackSwanScenarios[0]

/** Собирает цепочку решений так же, как это делает игра. */
function buildDecisions(
  actions: BlackSwanAction[],
  source: BlackSwanScenario = scenario,
): BlackSwanDecision[] {
  let exposure = source.initialPosition

  return actions.map((action, phaseIndex) => {
    const exposureBefore = exposure
    exposure = applyBlackSwanAction(exposureBefore, action)
    return {
      phaseIndex,
      action,
      exposureBefore,
      exposureAfter: exposure,
      timeMs: 4000,
      timedOut: false,
    }
  })
}

describe('applyBlackSwanAction', () => {
  it('закрытие обнуляет экспозицию', () => {
    expect(applyBlackSwanAction(0.6, 'close')).toBe(0)
  })

  it('хедж оставляет часть позиции', () => {
    expect(applyBlackSwanAction(0.6, 'hedge')).toBeCloseTo(0.21, 6)
  })

  it('держать не меняет позицию', () => {
    expect(applyBlackSwanAction(0.6, 'hold')).toBe(0.6)
  })

  it('увеличение ограничено 100%', () => {
    expect(applyBlackSwanAction(0.8, 'increase')).toBe(1)
  })
})

describe('computeBlackSwan', () => {
  it('стартует с исходного PnL портфеля', () => {
    const flat: BlackSwanScenario = {
      ...scenario,
      phases: scenario.phases.map((phase) => ({ ...phase, priceChange: 0 })),
    }
    const result = computeBlackSwan(flat, buildDecisions(['hold', 'hold', 'hold'], flat))

    expect(result.pnlPercent).toBeCloseTo(flat.initialPnl, 6)
  })

  it('часть движения фазы всегда приходится на входящую экспозицию', () => {
    // Мгновенное закрытие не спасает от уже случившегося движения.
    const closed = computeBlackSwan(scenario, buildDecisions(['close', 'close', 'close']))
    expect(closed.pnlPercent).toBeLessThan(scenario.initialPnl)
  })

  it('раннее сокращение риска лучше удержания на падающем сценарии', () => {
    const held = computeBlackSwan(scenario, buildDecisions(['hold', 'hold', 'hold']))
    const cut = computeBlackSwan(scenario, buildDecisions(['close', 'hold', 'hold']))

    expect(cut.pnl).toBeGreaterThan(held.pnl)
  })

  it('наращивание позиции на падении ухудшает результат', () => {
    const held = computeBlackSwan(scenario, buildDecisions(['hold', 'hold', 'hold']))
    const added = computeBlackSwan(scenario, buildDecisions(['increase', 'increase', 'hold']))

    expect(added.pnl).toBeLessThan(held.pnl)
  })

  it('хедж стоит денег по сравнению с бесплатным сокращением', () => {
    const hedged = computeBlackSwan(scenario, buildDecisions(['hedge', 'hold', 'hold']))
    const decisions = buildDecisions(['hedge', 'hold', 'hold'])
    const withoutCost = computeBlackSwan(
      scenario,
      decisions.map((decision, index) =>
        index === 0 ? { ...decision, action: 'hold' as const, exposureAfter: decision.exposureAfter } : decision,
      ),
    )

    expect(hedged.pnl).toBeLessThan(withoutCost.pnl)
  })

  it('считает количество изменений позиции', () => {
    const result = computeBlackSwan(scenario, buildDecisions(['hold', 'close', 'hold']))
    expect(result.positionChanges).toBe(1)
  })

  it('максимальная экспозиция учитывает и исходную позицию', () => {
    const result = computeBlackSwan(scenario, buildDecisions(['close', 'close', 'close']))
    expect(result.maxExposure).toBeCloseTo(scenario.initialPosition, 6)
  })

  it('pnlPercent соответствует pnl относительно капитала', () => {
    const result = computeBlackSwan(scenario, buildDecisions(['hedge', 'hold', 'increase']))
    expect(result.pnlPercent).toBeCloseTo((result.pnl / CAPITAL) * 100, 9)
  })
})

describe('computeRevealedPnl', () => {
  it('на полностью раскрытой траектории совпадает с итоговым PnL', () => {
    const decisions = buildDecisions(['hedge', 'close', 'increase'])
    const path = buildShockPath(scenario)
    const final = computeBlackSwan(scenario, decisions)

    expect(computeRevealedPnl(scenario, decisions, path, path.points.length)).toBeCloseTo(
      final.pnl,
      6,
    )
  })

  it('до начала первой фазы показывает только исходный PnL', () => {
    const path = buildShockPath(scenario)
    const revealed = computeRevealedPnl(scenario, [], path, path.phaseStart[0])

    expect(revealed).toBeCloseTo((scenario.initialPnl / 100) * CAPITAL, 6)
  })
})

describe('buildShockPath', () => {
  it('детерминирован по seed', () => {
    expect(buildShockPath(scenario).points).toEqual(buildShockPath(scenario).points)
  })

  it('приводит цену фазы к заданному изменению', () => {
    const path = buildShockPath(scenario)
    const start = path.points[path.phaseStart[0] - 1]
    const end = path.points[path.visibleAfterPhase[0] - 1]
    const change = ((end - start) / start) * 100

    // Цены округляются до сотых, поэтому допускаем погрешность округления.
    expect(Math.abs(change - scenario.phases[0].priceChange)).toBeLessThan(0.05)
  })
})

describe('blackSwanScore', () => {
  it('остаётся в диапазоне 0–100', () => {
    expect(blackSwanScore(500, 0)).toBeLessThanOrEqual(100)
    expect(blackSwanScore(-500, 80)).toBeGreaterThanOrEqual(0)
  })
})

describe('blackSwanTraits', () => {
  it('таймаут снижает дисциплину, но не обнуляет профиль', () => {
    const decisions = buildDecisions(['hold', 'hold', 'hold'])
    const computation = computeBlackSwan(scenario, decisions)

    const base = {
      scenarioId: scenario.id,
      seed: scenario.seed,
      pnl: computation.pnl,
      pnlPercent: computation.pnlPercent,
      maxDrawdown: computation.maxDrawdown,
      maxExposure: computation.maxExposure,
      positionChanges: computation.positionChanges,
      timeToDecision: [5000, 5000, 5000],
      score: computation.score,
    }

    const deliberate = blackSwanTraits({ ...base, decisions }, scenario)
    const timedOut = blackSwanTraits(
      { ...base, decisions: decisions.map((d) => ({ ...d, timedOut: true })) },
      scenario,
    )

    expect(timedOut.discipline).toBeLessThan(deliberate.discipline)
    expect(timedOut.discipline).toBeGreaterThanOrEqual(0)
  })
})
