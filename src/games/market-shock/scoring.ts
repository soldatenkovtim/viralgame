import { formatPercent } from '@/lib/formatting'
import { clamp, mapRange } from '@/lib/random'
import type {
  MarketShockResult,
  MarketShockScenario,
  ShockDecision,
  UserPriceLevel,
} from '@/types/game'
import {
  decisionCandleIndex,
  holdDecisions,
  initialExposure,
  positionLabel,
  simulateShock,
} from './engine'

type ResultCore = Omit<MarketShockResult, 'score'>

export interface ShockScoreBreakdown {
  pnlScore: number
  drawdownControlScore: number
  exposureManagementScore: number
  adaptabilityScore: number
  total: number
}

/** Движение цены (в %) от каждого решения до следующей контрольной точки или конца сценария. */
export function segmentMoves(scenario: MarketShockScenario): [number, number, number] {
  const { candles } = scenario
  return [1, 2, 3].map((phase) => {
    const from = candles[decisionCandleIndex(scenario, phase)].close
    const toIndex = phase < 3 ? decisionCandleIndex(scenario, phase + 1) : candles.length - 1
    return (candles[toIndex].close / from - 1) * 100
  }) as [number, number, number]
}

/**
 * Насколько изменения позиции совпали с тем, что рынок сделал дальше:
 * +1 — всё время сокращал перед падением и наращивал перед ростом, −1 — наоборот.
 */
export function decisionAlignment(scenario: MarketShockScenario, decisions: ShockDecision[]): number {
  const moves = segmentMoves(scenario)
  let aligned = 0
  let scale = 0
  decisions.forEach((decision) => {
    const move = moves[decision.phase - 1] ?? 0
    aligned += (decision.positionAfter - decision.positionBefore) * move
    scale += Math.abs(move)
  })
  return scale > 0 ? aligned / (scale * 0.5) : 0
}

function timeouts(decisions: ShockDecision[]): number {
  return decisions.filter((decision) => decision.timedOut).length
}

function adaptabilityScore(result: ResultCore, scenario: MarketShockScenario): number {
  const base =
    result.positionChanges === 0
      ? 40
      : mapRange(decisionAlignment(scenario, result.decisions), -0.6, 0.6, 10, 100)
  return clamp(base - timeouts(result.decisions) * 8, 0, 100)
}

export function marketShockScore(
  result: ResultCore,
  scenario: MarketShockScenario,
): ShockScoreBreakdown {
  const baseline = simulateShock(scenario, holdDecisions(scenario)).pnlPercent
  const startSize = Math.abs(initialExposure(scenario))

  const pnlScore = mapRange(result.pnlPercent, -8, 5, 0, 100)
  const drawdownControlScore = mapRange(result.maxDrawdown, 1, 9, 100, 0)
  const exposureManagementScore =
    mapRange(result.pnlPercent - baseline, -3, 3, 0, 100) * 0.6 +
    mapRange(result.maxExposure, startSize, 1, 100, 40) * 0.4
  const adaptability = adaptabilityScore(result, scenario)

  const total =
    pnlScore * 0.4 +
    drawdownControlScore * 0.25 +
    exposureManagementScore * 0.2 +
    adaptability * 0.15

  return {
    pnlScore,
    drawdownControlScore,
    exposureManagementScore,
    adaptabilityScore: adaptability,
    total: clamp(total, 0, 100),
  }
}

export function buildMarketShockResult(
  scenario: MarketShockScenario,
  decisions: ShockDecision[],
  levels: UserPriceLevel[],
): MarketShockResult {
  const simulation = simulateShock(scenario, decisions)
  const pnlAtIndex = new Map(simulation.points.map((point) => [point.index, point.pnlPercent]))

  const completed = decisions.map((decision, index) => {
    const next = decisions[index + 1]
    const nextIndex = next ? decisionCandleIndex(scenario, next.phase) : scenario.candles.length - 1
    return { ...decision, pnlAfter: pnlAtIndex.get(nextIndex) ?? simulation.pnlPercent }
  })

  const sizes = [initialExposure(scenario), ...decisions.map((decision) => decision.positionAfter)].map(
    Math.abs,
  )

  const core: ResultCore = {
    scenarioId: scenario.id,
    seed: scenario.seed,
    pattern: scenario.pattern,
    pnl: simulation.pnl,
    pnlPercent: simulation.pnlPercent,
    maxDrawdown: simulation.maxDrawdown,
    maxExposure: Math.max(...sizes),
    minExposure: Math.min(...sizes),
    positionChanges: decisions.filter((decision) => decision.positionAfter !== decision.positionBefore)
      .length,
    averageDecisionMs: decisions.length
      ? decisions.reduce((sum, decision) => sum + decision.decisionTimeMs, 0) / decisions.length
      : 0,
    decisions: completed,
    levels,
    maxDrawdownIndex: simulation.maxDrawdownIndex,
    maxPnlIndex: simulation.maxPnlIndex,
    maxPnlPercent: simulation.maxPnlPercent,
  }

  return { ...core, score: marketShockScore(core, scenario).total }
}

/* ------------------------------------------------------------------ */
/* Вклад в торговый профиль                                            */
/* ------------------------------------------------------------------ */

export interface MarketShockTraits {
  riskControl: number
  adaptability: number
  discipline: number
}

export function marketShockTraits(
  result: MarketShockResult,
  scenario: MarketShockScenario,
): MarketShockTraits {
  const startSize = Math.abs(initialExposure(scenario))
  const riskControl =
    mapRange(result.maxDrawdown, 0.5, 9, 100, 15) * 0.6 +
    mapRange(result.maxExposure, startSize, 1, 90, 30) * 0.4

  const changeScore = mapRange(result.positionChanges, 0, 3, 40, 92)
  const adaptability = adaptabilityScore(result, scenario) * 0.65 + changeScore * 0.35

  const deliberation = mapRange(result.averageDecisionMs, 1500, 9000, 45, 100)
  const discipline = clamp(
    deliberation - timeouts(result.decisions) * 18 - countThrash(result.decisions) * 12,
    0,
    100,
  )

  return {
    riskControl: clamp(riskControl, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
    discipline,
  }
}

/** Сокращение сразу после наращивания — признак метаний. */
function countThrash(decisions: ShockDecision[]): number {
  let thrash = 0
  for (let i = 1; i < decisions.length; i += 1) {
    const grew = Math.abs(decisions[i - 1].positionAfter) > Math.abs(decisions[i - 1].positionBefore)
    const shrank = Math.abs(decisions[i].positionAfter) < Math.abs(decisions[i].positionBefore)
    if (grew && shrank) thrash += 1
  }
  return thrash
}

/* ------------------------------------------------------------------ */
/* Наблюдения                                                          */
/* ------------------------------------------------------------------ */

function reduced(decision: ShockDecision): boolean {
  return Math.abs(decision.positionAfter) < Math.abs(decision.positionBefore)
}

function kept(decision: ShockDecision): boolean {
  return Math.abs(decision.positionAfter) >= Math.abs(decision.positionBefore)
}

/** Пробила ли цена отмеченный уровень против позиции между двумя точками. */
function brokeLevelAgainst(
  levels: UserPriceLevel[],
  from: number,
  to: number,
  direction: number,
): boolean {
  return levels.some((level) =>
    direction > 0 ? from > level.price && to <= level.price : from < level.price && to >= level.price,
  )
}

/**
 * 1–2 нейтральных наблюдения о поведении. Описывают, что происходило с позицией,
 * но не оценивают решения как правильные или ошибочные.
 */
export function marketShockInsights(
  result: MarketShockResult,
  scenario: MarketShockScenario,
): string[] {
  const { decisions, levels } = result
  const direction = Math.sign(initialExposure(scenario))
  const moves = segmentMoves(scenario).map((move) => move * direction)
  const startPrice = scenario.candles[scenario.initialVisibleIndex - 1].close
  const notes: string[] = []
  const push = (text: string) => {
    if (notes.length < 2 && !notes.includes(text)) notes.push(text)
  }

  const [first, second, third] = decisions

  const levelCut = decisions.find((decision, index) => {
    const from = index === 0 ? startPrice : decisions[index - 1].price
    return reduced(decision) && brokeLevelAgainst(levels, from, decision.price, direction)
  })
  if (levelCut) {
    push(
      levelCut.phase > 1 && first && kept(first)
        ? 'После первого роста волатильности ты сохранил позицию, но сократил риск после пробоя отмеченного уровня.'
        : 'Ты сократил риск сразу после пробоя отмеченного уровня — разметка стала точкой решения.',
    )
  }

  const addedIntoLoss = decisions.find(
    (decision) => decision.action === 'increase' && moves[decision.phase - 1] < -1,
  )
  if (addedIntoLoss) {
    push(
      'Ты увеличил позицию перед движением против неё, поэтому основная часть просадки пришлась на увеличенную экспозицию.',
    )
  }

  if (first && reduced(first) && moves[0] < -2) {
    push('Ты сократил риск на раннем сигнале, и основная часть шока пришлась на небольшой остаток позиции.')
  }

  if (first && kept(first) && moves[0] < -2) {
    push(
      `Ты вошёл в основную фазу шока с позицией ${positionLabel(first.positionAfter)} — движение пришлось на неё целиком.`,
    )
  }

  const cutBeforeRecovery = decisions.find((decision) => {
    const later = moves.slice(decision.phase - 1).reduce((sum, move) => sum + move, 0)
    return reduced(decision) && later > 1.5
  })
  if (cutBeforeRecovery) {
    push(
      cutBeforeRecovery.positionAfter === 0
        ? 'Ты закрыл позицию до восстановления рынка: риск снизился, но последующий возврат прошёл без позиции.'
        : 'Ты снизил риск до восстановления рынка и участвовал в возврате остатком позиции.',
    )
  }

  if (second && third && kept(second) && moves[1] + moves[2] > 1.5 && second.positionAfter !== 0) {
    push('После шока ты сохранил экспозицию и участвовал в восстановлении цены.')
  }

  if (timeouts(decisions) >= 2) {
    push('В двух фазах решение не было принято до конца отсчёта — позиция оставалась без изменений.')
  }

  if (notes.length === 0) {
    if (result.positionChanges === 0) {
      push('Ты провёл позицию через весь сценарий без изменений.')
    } else {
      push(
        `Экспозиция по ходу сценария менялась от ${Math.round(result.minExposure * 100)}% до ${Math.round(result.maxExposure * 100)}%, итог — ${formatPercent(result.pnlPercent)} к капиталу.`,
      )
    }
  }

  return notes
}
