import { CAPITAL } from '@/lib/constants'
import { clamp, mapRange } from '@/lib/random'
import type {
  BlindDecision,
  BlindFollowUpAction,
  BlindMarketResult,
  BlindMarketScenario,
} from '@/types/game'

export const POSITION_SIZES = [0.25, 0.5, 0.75, 1] as const
export type PositionSize = (typeof POSITION_SIZES)[number]

/**
 * Как действие на очередной точке меняет экспозицию.
 * Экспозиция хранится со знаком: > 0 — лонг, < 0 — шорт, 0 — вне рынка.
 */
export function applyAction(exposure: number, action: BlindFollowUpAction): number {
  switch (action) {
    case 'increase':
      return clamp(roundExposure(exposure + Math.sign(exposure) * 0.25), -1, 1)
    case 'hold':
      return exposure
    case 'reduce':
      return roundExposure(exposure / 2)
    case 'close':
      return 0
    case 'flip':
      return -exposure
    case 'enter-long':
      return 0.5
    case 'enter-short':
      return -0.5
    case 'stay-flat':
      return 0
  }
}

function roundExposure(value: number): number {
  return Math.round(value * 100) / 100
}

/** Набор действий зависит от того, есть ли сейчас позиция. */
export function getFollowUpActions(exposure: number): BlindFollowUpAction[] {
  if (exposure === 0) return ['enter-long', 'enter-short', 'stay-flat']
  return ['increase', 'hold', 'reduce', 'close', 'flip']
}

export const actionLabels: Record<BlindFollowUpAction, string> = {
  increase: 'Увеличить позицию',
  hold: 'Держать',
  reduce: 'Сократить',
  close: 'Закрыть',
  flip: 'Перевернуться',
  'enter-long': 'Войти в лонг',
  'enter-short': 'Войти в шорт',
  'stay-flat': 'Остаться вне рынка',
}

/** Короткая подпись для таймлайна и сравнения с другим игроком. */
export const actionShortLabels: Record<BlindFollowUpAction, string> = {
  increase: 'Увеличил',
  hold: 'Держал',
  reduce: 'Сократил',
  close: 'Закрыл',
  flip: 'Перевернулся',
  'enter-long': 'Вошёл в лонг',
  'enter-short': 'Вошёл в шорт',
  'stay-flat': 'Остался вне рынка',
}

export interface BlindComputation {
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  equityCurve: number[]
  segmentReturns: number[]
  directionChanges: number
  averageConfidence: number
  score: number
}

/**
 * Считает PnL по изменению цены между точками решений.
 * Капитал не реинвестируется: база расчёта постоянна, как в задании.
 */
export function computeBlindMarket(
  scenario: BlindMarketScenario,
  decisions: BlindDecision[],
): BlindComputation {
  const { candles, checkpoints } = scenario
  const equityCurve: number[] = [CAPITAL]
  const segmentReturns: number[] = []
  let pnl = 0

  const boundaries = [...checkpoints, candles.length]

  for (let segment = 0; segment < boundaries.length - 1; segment += 1) {
    const exposure = decisions[segment]?.exposure ?? 0
    const from = boundaries[segment]
    const to = boundaries[segment + 1]

    const startPrice = candles[from - 1].close
    const endPrice = candles[to - 1].close
    segmentReturns.push(((endPrice - startPrice) / startPrice) * 100)

    for (let i = from; i < to; i += 1) {
      const previous = candles[i - 1].close
      const current = candles[i].close
      pnl += exposure * ((current - previous) / previous) * CAPITAL
      equityCurve.push(CAPITAL + pnl)
    }
  }

  const pnlPercent = (pnl / CAPITAL) * 100
  const maxDrawdown = computeMaxDrawdown(equityCurve)

  let directionChanges = 0
  for (let i = 1; i < decisions.length; i += 1) {
    if (Math.sign(decisions[i].exposure) !== Math.sign(decisions[i - 1].exposure)) {
      directionChanges += 1
    }
  }

  const averageConfidence = decisions.length
    ? decisions.reduce((sum, decision) => sum + decision.confidence, 0) / decisions.length
    : 0

  return {
    pnl,
    pnlPercent,
    maxDrawdown,
    equityCurve,
    segmentReturns,
    directionChanges,
    averageConfidence,
    score: blindScore(pnlPercent, maxDrawdown),
  }
}

/**
 * PnL на произвольной свече — нужен, чтобы показывать живой результат
 * прямо во время раскрытия рынка.
 */
export function computeRunningPnl(
  scenario: BlindMarketScenario,
  decisions: BlindDecision[],
  upToIndex: number,
): number {
  const { candles, checkpoints } = scenario
  const boundaries = [...checkpoints, candles.length]
  let pnl = 0

  for (let segment = 0; segment < boundaries.length - 1; segment += 1) {
    const exposure = decisions[segment]?.exposure
    if (exposure === undefined) break

    const from = boundaries[segment]
    const to = Math.min(boundaries[segment + 1], upToIndex + 1)

    for (let i = from; i < to; i += 1) {
      const previous = candles[i - 1].close
      const current = candles[i].close
      pnl += exposure * ((current - previous) / previous) * CAPITAL
    }

    if (to < boundaries[segment + 1]) break
  }

  return pnl
}

/** Просадка в процентах от локального пика (положительное число). */
export function computeMaxDrawdown(equityCurve: number[]): number {
  let peak = equityCurve[0] ?? CAPITAL
  let maxDrawdown = 0

  for (const value of equityCurve) {
    if (value > peak) peak = value
    const drawdown = ((peak - value) / peak) * 100
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  return maxDrawdown
}

/** Игровой score испытания, 0–100. */
export function blindScore(pnlPercent: number, maxDrawdown: number): number {
  const pnlScore = mapRange(pnlPercent, -12, 12, 0, 100)
  const drawdownScore = mapRange(maxDrawdown, 0, 12, 100, 0)
  return clamp(pnlScore * 0.72 + drawdownScore * 0.28, 0, 100)
}

export interface BlindTraits {
  marketSense: number
  adaptability: number
  discipline: number
}

/**
 * Качества, которые Blind Market передаёт в Trading Profile.
 * Это игровые характеристики поведения, а не оценка квалификации.
 */
export function blindTraits(result: BlindMarketResult): BlindTraits {
  const { decisions, segmentReturns, maxDrawdown, averageConfidence } = result

  // Рыночное чутьё: насколько экспозиция совпадала с реализованным движением.
  let captured = 0
  let available = 0
  segmentReturns.forEach((segmentReturn, index) => {
    const exposure = decisions[index]?.exposure ?? 0
    captured += exposure * segmentReturn
    available += Math.abs(segmentReturn)
  })
  const capture = available > 0 ? captured / available : 0
  const marketSense = mapRange(capture, -0.7, 0.85, 12, 100)

  // Адаптивность: помогали ли изменения позиции на следующем отрезке.
  let benefit = 0
  let scale = 0
  for (let index = 1; index < segmentReturns.length; index += 1) {
    const before = decisions[index - 1]?.exposure ?? 0
    const after = decisions[index]?.exposure ?? 0
    benefit += (after - before) * segmentReturns[index]
    scale += Math.abs(segmentReturns[index])
  }
  const adjustmentQuality = scale > 0 ? benefit / scale : 0
  const activity = decisions.filter(
    (decision, index) => index > 0 && decision.action !== 'hold',
  ).length
  const adaptability =
    mapRange(adjustmentQuality, -0.6, 0.8, 18, 96) * 0.75 +
    mapRange(activity, 0, 2, 35, 90) * 0.25

  // Дисциплина: контроль просадки и честность собственной уверенности.
  const hitRate = computeHitRate(decisions, segmentReturns)
  const calibrationError = Math.abs(averageConfidence / 100 - hitRate)
  const calibrationScore = mapRange(calibrationError, 0, 0.45, 100, 25)
  const drawdownScore = mapRange(maxDrawdown, 0, 12, 100, 28)
  const discipline = drawdownScore * 0.55 + calibrationScore * 0.45

  return {
    marketSense: clamp(marketSense, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
    discipline: clamp(discipline, 0, 100),
  }
}

/** Доля отрезков, где знак позиции совпал со знаком движения. */
export function computeHitRate(
  decisions: BlindDecision[],
  segmentReturns: number[],
): number {
  if (!segmentReturns.length) return 0.5
  let hits = 0

  segmentReturns.forEach((segmentReturn, index) => {
    const exposure = decisions[index]?.exposure ?? 0
    if (exposure === 0) {
      // Быть вне рынка — попадание, если движение оказалось незначительным.
      hits += Math.abs(segmentReturn) < 1.5 ? 1 : 0.35
      return
    }
    if (Math.sign(exposure) === Math.sign(segmentReturn)) hits += 1
  })

  return hits / segmentReturns.length
}
