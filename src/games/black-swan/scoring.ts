import {
  BLACK_SWAN_HEDGE_COST_PERCENT,
  BLACK_SWAN_HEDGE_RESIDUAL,
} from '@/data/blackSwanScenarios'
import { CAPITAL } from '@/lib/constants'
import { clamp, mapRange } from '@/lib/random'
import type {
  BlackSwanAction,
  BlackSwanDecision,
  BlackSwanResult,
  BlackSwanScenario,
} from '@/types/game'
import {
  PRE_DECISION_SPLIT,
  SHOCK_POST_POINTS,
  SHOCK_PRE_POINTS,
  type ShockPath,
} from './path'

export const actionLabels: Record<BlackSwanAction, string> = {
  close: 'Закрыть',
  hedge: 'Хеджировать',
  hold: 'Держать',
  increase: 'Увеличить',
}

export const actionShortLabels: Record<BlackSwanAction, string> = {
  close: 'Закрыл',
  hedge: 'Хеджировал',
  hold: 'Держал',
  increase: 'Увеличил',
}

export const BLACK_SWAN_ACTIONS: BlackSwanAction[] = ['close', 'hedge', 'hold', 'increase']

/** Как решение меняет экспозицию портфеля. */
export function applyBlackSwanAction(exposure: number, action: BlackSwanAction): number {
  switch (action) {
    case 'close':
      return 0
    case 'hedge':
      return round2(exposure * BLACK_SWAN_HEDGE_RESIDUAL)
    case 'hold':
      return exposure
    case 'increase':
      return clamp(round2(exposure * 1.4), -1, 1)
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface BlackSwanComputation {
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  maxExposure: number
  positionChanges: number
  equityCurve: number[]
  phasePnl: number[]
  score: number
}

/**
 * Считает результат по фазам.
 *
 * Каждая фаза разбита на две части: рынок сначала двигается, и только потом
 * игрок принимает решение. Поэтому часть движения всегда приходится на ту
 * экспозицию, с которой игрок в фазу вошёл.
 */
export function computeBlackSwan(
  scenario: BlackSwanScenario,
  decisions: BlackSwanDecision[],
): BlackSwanComputation {
  let pnl = (scenario.initialPnl / 100) * CAPITAL
  const equityCurve: number[] = [CAPITAL + pnl]
  const phasePnl: number[] = []

  let maxExposure = Math.abs(scenario.initialPosition)
  let positionChanges = 0
  let exposure = scenario.initialPosition

  scenario.phases.forEach((phase, index) => {
    const preChange = (phase.priceChange * PRE_DECISION_SPLIT) / 100
    const preResult = exposure * preChange * CAPITAL
    pnl += preResult
    equityCurve.push(CAPITAL + pnl)

    const decision = decisions[index]
    if (!decision) {
      phasePnl.push(preResult)
      return
    }

    if (decision.exposureAfter !== decision.exposureBefore) positionChanges += 1
    exposure = decision.exposureAfter
    maxExposure = Math.max(maxExposure, Math.abs(exposure))

    // Хедж стоит денег — иначе он был бы бесплатным «правильным ответом».
    const hedgeCost =
      decision.action === 'hedge'
        ? (BLACK_SWAN_HEDGE_COST_PERCENT / 100) *
          Math.abs(decision.exposureBefore) *
          CAPITAL
        : 0

    const postChange = (phase.priceChange * (1 - PRE_DECISION_SPLIT)) / 100
    const postResult = exposure * postChange * CAPITAL - hedgeCost
    pnl += postResult
    equityCurve.push(CAPITAL + pnl)

    phasePnl.push(preResult + postResult)
  })

  const pnlPercent = (pnl / CAPITAL) * 100

  let peak = equityCurve[0]
  let maxDrawdown = 0
  for (const value of equityCurve) {
    if (value > peak) peak = value
    maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100)
  }

  return {
    pnl,
    pnlPercent,
    maxDrawdown,
    maxExposure,
    positionChanges,
    equityCurve,
    phasePnl,
    score: blackSwanScore(pnlPercent, maxDrawdown),
  }
}

/**
 * PnL по уже раскрытой части траектории.
 *
 * Считается по той же pre/post-модели, что и финальный результат, поэтому
 * число на экране во время игры сходится с итоговым.
 */
export function computeRevealedPnl(
  scenario: BlackSwanScenario,
  decisions: BlackSwanDecision[],
  path: ShockPath,
  visiblePoints: number,
): number {
  let pnl = (scenario.initialPnl / 100) * CAPITAL
  let exposure = scenario.initialPosition

  scenario.phases.forEach((phase, index) => {
    const preFraction = clamp(
      (visiblePoints - path.phaseStart[index]) / SHOCK_PRE_POINTS,
      0,
      1,
    )
    if (preFraction <= 0) return

    const preChange = (phase.priceChange * PRE_DECISION_SPLIT) / 100
    pnl += exposure * preChange * CAPITAL * preFraction

    const decision = decisions[index]
    if (!decision) return

    const postFraction = clamp(
      (visiblePoints - path.visibleAtDecision[index]) / SHOCK_POST_POINTS,
      0,
      1,
    )
    if (postFraction <= 0) return

    exposure = decision.exposureAfter

    const hedgeCost =
      decision.action === 'hedge'
        ? (BLACK_SWAN_HEDGE_COST_PERCENT / 100) *
          Math.abs(decision.exposureBefore) *
          CAPITAL
        : 0

    const postChange = (phase.priceChange * (1 - PRE_DECISION_SPLIT)) / 100
    pnl += exposure * postChange * CAPITAL * postFraction - hedgeCost
  })

  return pnl
}

/** Игровой score испытания, 0–100. */
export function blackSwanScore(pnlPercent: number, maxDrawdown: number): number {
  const pnlScore = mapRange(pnlPercent, -18, 10, 0, 100)
  const drawdownScore = mapRange(maxDrawdown, 0, 18, 100, 0)
  return clamp(pnlScore * 0.6 + drawdownScore * 0.4, 0, 100)
}

export interface BlackSwanTraits {
  riskControl: number
  adaptability: number
  discipline: number
}

export function blackSwanTraits(
  result: BlackSwanResult,
  scenario: BlackSwanScenario,
): BlackSwanTraits {
  const { decisions, maxDrawdown, maxExposure, timeToDecision } = result

  const riskControl =
    mapRange(maxDrawdown, 0, 18, 100, 15) * 0.6 +
    mapRange(maxExposure, 0.3, 1, 95, 25) * 0.4

  // Адаптивность: снижал ли игрок риск перед тем, что произойдёт дальше.
  let anticipation = 0
  let scale = 0
  scenario.phases.forEach((phase, index) => {
    const decision = decisions[index]
    if (!decision) return
    const upcoming = scenario.phases[index + 1]?.priceChange ?? phase.priceChange
    const exposureDelta = decision.exposureAfter - decision.exposureBefore
    anticipation += exposureDelta * upcoming
    scale += Math.abs(upcoming)
  })
  const anticipationScore = mapRange(scale > 0 ? anticipation / scale : 0, -0.5, 0.6, 20, 100)
  const changeScore = mapRange(result.positionChanges, 0, 3, 40, 92)
  const adaptability = anticipationScore * 0.65 + changeScore * 0.35

  // Дисциплина: осознанность решений — без таймаутов и без метаний.
  const timeouts = decisions.filter((decision) => decision.timedOut).length
  const averageTime = timeToDecision.length
    ? timeToDecision.reduce((sum, value) => sum + value, 0) / timeToDecision.length
    : 0
  const deliberation = mapRange(averageTime, 900, 9000, 45, 100)
  const timeoutPenalty = timeouts * 18
  const flipFlop = countDirectionThrash(decisions) * 12
  const discipline = clamp(deliberation - timeoutPenalty - flipFlop, 0, 100)

  return {
    riskControl: clamp(riskControl, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
    discipline,
  }
}

/** Сокращение сразу после наращивания (и наоборот) — признак метаний. */
function countDirectionThrash(decisions: BlackSwanDecision[]): number {
  let thrash = 0
  for (let i = 1; i < decisions.length; i += 1) {
    const previous = decisions[i - 1]
    const current = decisions[i]
    const previousGrew = previous.exposureAfter > previous.exposureBefore
    const currentShrank = current.exposureAfter < current.exposureBefore
    if (previousGrew && currentShrank) thrash += 1
  }
  return thrash
}
