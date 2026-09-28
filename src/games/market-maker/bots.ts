import type { SeededRandom } from '@/lib/random'
import type { FlowRegime } from '@/types/game'

export interface BotOrder {
  side: 'buy' | 'sell'
  size: number
}

export interface FlowContext {
  random: SeededRandom
  tick: number
  fairValue: number[]
  marketPrice: number[]
  bid: number
  ask: number
  /** Множитель интенсивности текущей фазы. */
  intensity: number
  /** Недавний перекос потока: +1 — только покупки, −1 — только продажи. */
  imbalance: number
}

/** На сколько тиков вперёд видит справедливую цену информированный поток. */
export const INFORMED_LOOKAHEAD = 10
/** За сколько тиков моментум-поток оценивает движение рынка. */
const MOMENTUM_WINDOW = 6
const MOMENTUM_THRESHOLD = 0.08

interface RegimeProfile {
  /** Вероятность появления заявки на тике. */
  intensity: number
  /** Масштаб чувствительности к цене: чем больше, тем терпимее к широкому спреду. */
  priceTolerance: number
  /** Вероятности размеров 1, 2, 3, 4, 5. */
  sizeWeights: readonly number[]
  /** Насколько сильно поток разворачивается после серии в одну сторону (0–0,5). */
  meanReversion: number
}

const PROFILES: Record<FlowRegime, RegimeProfile> = {
  noise: {
    intensity: 0.42,
    priceTolerance: 0.3,
    sizeWeights: [0.5, 0.32, 0.15, 0.03, 0],
    meanReversion: 0.3,
  },
  momentum: {
    intensity: 0.36,
    priceTolerance: 0.38,
    sizeWeights: [0.35, 0.33, 0.22, 0.07, 0.03],
    meanReversion: 0.22,
  },
  informed: {
    intensity: 0.34,
    priceTolerance: 0.45,
    sizeWeights: [0.25, 0.32, 0.28, 0.1, 0.05],
    meanReversion: 0,
  },
}

/**
 * Насколько котировка привлекательна для контрагента.
 * Чем дальше цена исполнения от его ориентира, тем реже сделка.
 */
export function spreadAttractiveness(distance: number, tolerance: number): number {
  if (distance <= 0) return 1
  return Math.exp(-distance / tolerance)
}

/**
 * Заявка контрагента на текущем тике.
 *
 * Каждый тик тратит одинаковое число случайных чисел, поэтому поток
 * воспроизводится по seed независимо от действий игрока.
 */
export function decideFlowOrder(regime: FlowRegime, context: FlowContext): BotOrder | null {
  const { random } = context
  const arrival = random.next()
  const sideRoll = random.next()
  const fillRoll = random.next()
  const sizeRoll = random.next()

  const profile = PROFILES[regime]
  if (arrival >= profile.intensity * context.intensity) return null

  const { side, reference } = sideAndReference(regime, profile, context, sideRoll)
  const distance = side === 'buy' ? context.ask - reference : reference - context.bid
  if (fillRoll >= spreadAttractiveness(distance, profile.priceTolerance)) return null

  return { side, size: pickSize(profile.sizeWeights, sizeRoll) }
}

function pickSize(weights: readonly number[], roll: number): number {
  let cumulative = 0
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index]
    if (roll < cumulative) return index + 1
  }
  return 1
}

/** Вероятность покупки с поправкой на недавний перекос потока. */
function revertedBuyShare(baseBuyShare: number, profile: RegimeProfile, imbalance: number): number {
  return Math.min(0.95, Math.max(0.05, baseBuyShare - profile.meanReversion * imbalance))
}

function sideAndReference(
  regime: FlowRegime,
  profile: RegimeProfile,
  { tick, fairValue, marketPrice, imbalance }: FlowContext,
  roll: number,
): { side: 'buy' | 'sell'; reference: number } {
  const market = marketPrice[tick]

  if (regime === 'informed') {
    const future = fairValue[Math.min(tick + INFORMED_LOOKAHEAD, fairValue.length - 1)]
    const expected = future - fairValue[tick]
    const bias = Math.abs(expected) > 0.05 ? 0.88 : 0.5
    const buyShare = expected >= 0 ? bias : 1 - bias
    // Ориентир информированного потока — будущая справедливая цена.
    return { side: roll < buyShare ? 'buy' : 'sell', reference: future }
  }

  if (regime === 'momentum') {
    const move = market - marketPrice[Math.max(0, tick - MOMENTUM_WINDOW)]
    if (Math.abs(move) < MOMENTUM_THRESHOLD) {
      const buyShare = revertedBuyShare(0.5, profile, imbalance)
      return { side: roll < buyShare ? 'buy' : 'sell', reference: market }
    }
    const buyShare = revertedBuyShare(move > 0 ? 0.78 : 0.22, profile, imbalance)
    // Моментум готов переплатить в сторону движения.
    return { side: roll < buyShare ? 'buy' : 'sell', reference: market + move * 0.6 }
  }

  const buyShare = revertedBuyShare(0.5, profile, imbalance)
  return { side: roll < buyShare ? 'buy' : 'sell', reference: market }
}
