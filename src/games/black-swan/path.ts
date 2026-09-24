import { createRandom } from '@/lib/random'
import type { BlackSwanScenario } from '@/types/game'

const HISTORY_POINTS = 24
const PRE_DECISION_POINTS = 9
const POST_DECISION_POINTS = 7
const BASE_PRICE = 100

/**
 * Доля движения фазы, которая происходит до решения игрока.
 *
 * Рынок сначала двигается и только потом спрашивает — успеть «выйти до шока»
 * невозможно. Именно поэтому спокойные ранние фазы оказываются важнее поздних.
 */
export const PRE_DECISION_SPLIT = 0.55

export interface ShockPath {
  points: number[]
  /** Индекс точки, с которой начинается фаза. */
  phaseStart: number[]
  /** Точек видно к моменту решения по фазе (движение уже случилось). */
  visibleAtDecision: number[]
  /** Точек видно после того, как фаза доигралась. */
  visibleAfterPhase: number[]
}

export function buildShockPath(scenario: BlackSwanScenario): ShockPath {
  const random = createRandom(scenario.seed)
  const points: number[] = []

  let price = BASE_PRICE
  for (let i = 0; i < HISTORY_POINTS; i += 1) {
    price += random.normal(0.04, 0.25)
    points.push(round2(price))
  }

  const phaseStart: number[] = []
  const visibleAtDecision: number[] = []
  const visibleAfterPhase: number[] = []

  scenario.phases.forEach((phase) => {
    const start = points[points.length - 1]
    const noise = 0.18 + (phase.volatilityChange / 100) * 0.5

    phaseStart.push(points.length)

    const preTarget = start * (1 + (phase.priceChange * PRE_DECISION_SPLIT) / 100)
    appendSegment(points, start, preTarget, PRE_DECISION_POINTS, noise, random)
    visibleAtDecision.push(points.length)

    const postTarget = start * (1 + phase.priceChange / 100)
    appendSegment(points, preTarget, postTarget, POST_DECISION_POINTS, noise, random)
    visibleAfterPhase.push(points.length)
  })

  return { points, phaseStart, visibleAtDecision, visibleAfterPhase }
}

function appendSegment(
  points: number[],
  from: number,
  to: number,
  steps: number,
  noise: number,
  random: ReturnType<typeof createRandom>,
): void {
  for (let step = 1; step <= steps; step += 1) {
    const eased = easeInOutCubic(step / steps)
    const base = from + (to - from) * eased
    const wobble = step === steps ? 0 : random.normal(0, noise)
    points.push(round2(base + wobble))
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export const SHOCK_HISTORY_POINTS = HISTORY_POINTS
export const SHOCK_PRE_POINTS = PRE_DECISION_POINTS
export const SHOCK_POST_POINTS = POST_DECISION_POINTS
