import { getCrossArbitrageScenario } from '@/data/crossArbitrageScenarios'
import { formatNumber, plural } from '@/lib/formatting'
import { clamp, mapRange } from '@/lib/random'
import type { SharePayload } from '@/lib/sharing'
import type {
  ArbitrageRoundResult,
  CrossArbitrageResult,
  CrossArbitrageScenario,
  CrossArbitrageSession,
} from '@/types/game'
import {
  ARB_POSITION_SIZES,
  bestTrade,
  buildQuotePath,
  evaluateTrade,
  quoteStepAt,
  windowCloseMs,
} from './engine'

/** Доля скорости в score — 15%. */
export const ARB_SPEED_BONUS_MAX = 15

export interface ArbitrageDecision {
  buyVenue?: string
  sellVenue?: string
  /** 0 — «Сделки нет». */
  positionSize: number
  decisionTimeMs: number
  timedOut: boolean
}

export function evaluateRound(
  scenario: CrossArbitrageScenario,
  decision: ArbitrageDecision,
): ArbitrageRoundResult {
  const path = buildQuotePath(scenario)
  const quoteStep = quoteStepAt(decision.decisionTimeMs, path.length)
  // Сравнение идёт с исходными котировками: дождаться схождения и нажать
  // «Сделки нет» не должно считаться верным ответом.
  const optimal = bestTrade(scenario.quotes)
  const closeMs = windowCloseMs(scenario, path)

  const choseNoTrade =
    decision.timedOut || decision.buyVenue === decision.sellVenue || !decision.buyVenue || !decision.sellVenue || decision.positionSize <= 0
  const outcome = choseNoTrade
    ? null
    : evaluateTrade(
        path[quoteStep],
        decision.buyVenue as string,
        decision.sellVenue as string,
        decision.positionSize,
      )

  const routeBest = outcome ? Math.max(...ARB_POSITION_SIZES.map((size) =>
    evaluateTrade(path[quoteStep], outcome.buyVenue, outcome.sellVenue, size).capitalReturn,
  )) : 0
  const sizingScore = outcome && routeBest > 0
    ? clamp(outcome.capitalReturn / routeBest, 0, 1) * 100
    : !outcome && optimal.capitalReturn <= 0 ? 100 : 0
  const capitalReturn = outcome?.capitalReturn ?? 0
  const optimalNetReturn = optimal.capitalReturn
  const hasOpportunity = optimalNetReturn > 0

  const optimalChoice = hasOpportunity
    ? !choseNoTrade &&
      decision.buyVenue === optimal.buyVenue &&
      decision.sellVenue === optimal.sellVenue && decision.positionSize === optimal.positionSize
    : choseNoTrade

  return {
    scenarioId: scenario.id,
    ...(outcome ? { buyVenue: outcome.buyVenue, sellVenue: outcome.sellVenue } : {}),
    choseNoTrade,
    timedOut: decision.timedOut,
    grossReturn: outcome?.grossReturn ?? 0,
    netBeforeLiquidity: outcome?.netBeforeLiquidity ?? 0,
    netReturn: outcome?.netReturn ?? 0,
    capitalReturn,
    optimalNetReturn,
    ...(hasOpportunity
      ? { optimalBuyVenue: optimal.buyVenue, optimalSellVenue: optimal.sellVenue, optimalPositionSize: optimal.positionSize }
      : {}),
    positionSize: outcome?.positionSize ?? 0,
    decisionTimeMs: decision.decisionTimeMs,
    quoteStep,
    liquidityHit: outcome?.liquidityHit ?? false,
    ...(outcome ? {
      avgBuyPrice: outcome.avgBuyPrice, avgSellPrice: outcome.avgSellPrice,
      feeReturn: outcome.feeReturn, slippageReturn: outcome.slippageReturn,
    } : {}),
    sizingScore,
    ...(closeMs !== null ? { msBeforeClose: closeMs - decision.decisionTimeMs } : {}),
    profitable: capitalReturn > 0,
    optimalChoice,
    roundScore: arbitrageRoundScore({
      optimalNetReturn,
      sizingScore,
      capitalReturn,
      choseNoTrade,
      decisionTimeMs: decision.decisionTimeMs,
      timedOut: decision.timedOut,
    }),
  }
}

/**
 * Захват edge (40%), отсутствие ложных сделок (25%), размер (20%), скорость (15%).
 * Пропуск возможности сохраняет компоненту отсутствия ложной сделки.
 */
export function arbitrageRoundScore({
  optimalNetReturn,
  capitalReturn,
  choseNoTrade,
  decisionTimeMs,
  timedOut,
  sizingScore,
}: {
  sizingScore?: number
  optimalNetReturn: number
  capitalReturn: number
  choseNoTrade: boolean
  decisionTimeMs: number
  timedOut: boolean
}): number {
  const edgeCaptureScore = optimalNetReturn <= 0
    ? choseNoTrade ? 100 : 0
    : clamp(capitalReturn / optimalNetReturn, 0, 1) * 100
  const falseTradeAvoidanceScore = choseNoTrade || capitalReturn > 0 ? 100 : 0
  const size = sizingScore ?? edgeCaptureScore
  // Скорость награждает только прибыльное исполнение или обоснованный пропуск.
  const speedScore = !timedOut && (capitalReturn > 0 || (choseNoTrade && optimalNetReturn <= 0))
    ? mapRange(decisionTimeMs, 3000, 12000, 100, 0) : 0
  return edgeCaptureScore * 0.40 + falseTradeAvoidanceScore * 0.25 + size * 0.20 + speedScore * 0.15
}

export function buildCrossArbitrageResult(
  session: CrossArbitrageSession,
  rounds: ArbitrageRoundResult[],
): CrossArbitrageResult {
  const opportunityRounds = rounds.filter((round) => round.optimalNetReturn > 0)
  const trades = rounds.filter((round) => !round.choseNoTrade)
  const profitable = trades.filter((round) => round.profitable)

  const averageDecisionMs =
    rounds.reduce((sum, round) => sum + round.decisionTimeMs, 0) / Math.max(1, rounds.length)

  return {
    scenarioId: session.id,
    seed: session.seed,
    rounds,
    totalReturnPercent: rounds.reduce((sum, round) => sum + round.capitalReturn, 0) * 100,
    opportunities: opportunityRounds.length,
    found: opportunityRounds.filter((round) => round.profitable).length,
    falseTrades: trades.filter((round) => !round.profitable).length,
    missed: opportunityRounds.filter((round) => round.choseNoTrade).length,
    correctPasses: rounds.filter(
      (round) => round.optimalNetReturn <= 0 && round.choseNoTrade,
    ).length,
    tradeCount: trades.length,
    averageDecisionMs,
    averageSizeUnits: trades.length ? trades.reduce((sum, round) => sum + round.positionSize * 100, 0) / trades.length : 0,
    sizeWorsenedCount: trades.filter((round) => round.liquidityHit && round.netReturn < round.netBeforeLiquidity).length,
    bestEdgePercent: profitable.length
      ? Math.max(...profitable.map((round) => round.netReturn)) * 100
      : 0,
    score:
      rounds.reduce((sum, round) => sum + round.roundScore, 0) / Math.max(1, rounds.length),
  }
}

/* ------------------------------------------------------------------ */
/* Тексты                                                              */
/* ------------------------------------------------------------------ */

/** Edge в процентах: +0,31% / −0,18% / 0,00%. */
export function formatEdge(percent: number, digits = 2): string {
  const rounded = Number(percent.toFixed(digits))
  const formatted = formatNumber(Math.abs(rounded), digits)
  if (rounded > 0) return `+${formatted}%`
  if (rounded < 0) return `−${formatted}%`
  return `${formatted}%`
}

export function venueName(scenario: CrossArbitrageScenario, venueId?: string): string {
  if (!venueId) return '—'
  return scenario.quotes.find((quote) => quote.venueId === venueId)?.venueName ?? venueId
}

export function sizeLabel(size: number): string {
  return `${Math.round(size * 100)} ед.`
}

export function routeLabel(
  scenario: CrossArbitrageScenario,
  buyVenue?: string,
  sellVenue?: string,
): string {
  return `${venueName(scenario, buyVenue)} → ${venueName(scenario, sellVenue)}`
}

export function formatDecisionSeconds(ms: number): string {
  return `${formatNumber(ms / 1000, 1)} сек.`
}

export function buildArbitrageSharePayload(
  session: CrossArbitrageSession,
  result: CrossArbitrageResult,
): SharePayload {
  return {
    t: 'cross-arbitrage',
    s: session.id,
    d: session.seed,
    r: Number(result.totalReturnPercent.toFixed(2)),
    a: result.rounds.map(roundShortLabel),
    m: [
      result.tradeCount,
      result.falseTrades,
      Math.round(result.averageDecisionMs),
      result.found,
      result.missed,
    ],
    p: result.rounds.map((round) => Number((round.capitalReturn * 100).toFixed(3))),
  }
}

/** Короткая подпись решения — для shared-сравнения и таймлайна. */
export function roundShortLabel(round: ArbitrageRoundResult): string {
  if (round.choseNoTrade) return round.timedOut ? 'Сделки нет · время' : 'Сделки нет'
  const scenario = getCrossArbitrageScenario(round.scenarioId)
  return `${routeLabel(scenario, round.buyVenue, round.sellVenue)} · ${sizeLabel(round.positionSize)}`
}

export interface RoundFeedback {
  /** Вклад рынка в капитал, %. */
  valuePercent: number
  title: string
  detail?: string
}

/** Объясняет экономический результат, а не «правильно / неправильно». */
export function roundFeedback(
  round: ArbitrageRoundResult,
  scenario: CrossArbitrageScenario,
): RoundFeedback {
  const valuePercent = round.capitalReturn * 100
  const hasOpportunity = round.optimalNetReturn > 0
  const bestRoute = hasOpportunity
    ? routeLabel(scenario, round.optimalBuyVenue, round.optimalSellVenue)
    : ''
  const bestValue = formatEdge(round.optimalNetReturn * 100)

  if (round.choseNoTrade) {
    if (!hasOpportunity) {
      return { valuePercent, title: 'Исполнимой возможности не было' }
    }
    if (round.msBeforeClose !== undefined && round.msBeforeClose <= 0) {
      return {
        valuePercent,
        title: 'Окно закрылось раньше решения',
        detail: `В начале рынка ${bestRoute} давал ${bestValue}`,
      }
    }
    return {
      valuePercent,
      title: round.timedOut ? 'Время вышло — возможность осталась' : 'Возможность пропущена',
      detail: `${bestRoute} давал ${bestValue}`,
    }
  }

  const tradedBestPair =
    round.buyVenue === round.optimalBuyVenue && round.sellVenue === round.optimalSellVenue

  if (round.profitable) {
    let detail: string | undefined
    if (hasOpportunity && !tradedBestPair) {
      detail = `${bestRoute} давал больше: ${bestValue}`
    } else if (round.liquidityHit) {
      detail = 'Часть объёма исполнилась хуже: не хватило ликвидности'
    } else if (round.capitalReturn < round.optimalNetReturn * 0.8) {
      detail = `Больший размер дал бы до ${bestValue}`
    }
    return { valuePercent, title: round.liquidityHit ? 'Часть edge потеряна из-за объёма' : 'Edge сохранился после комиссий', ...(detail ? { detail } : {}) }
  }

  if (tradedBestPair && round.quoteStep > 0) {
    return {
      valuePercent,
      title: 'Котировки успели сойтись раньше сделки',
      detail: `В начале рынка этот маршрут давал ${bestValue}`,
    }
  }

  if (round.grossReturn <= 0) {
    return {
      valuePercent,
      title: hasOpportunity ? 'Спред был в другой паре' : 'Цена продажи оказалась ниже цены покупки',
      ...(hasOpportunity ? { detail: `${bestRoute} давал ${bestValue}` } : {}),
    }
  }

  if (round.netBeforeLiquidity <= 0) {
    const buy = scenario.quotes.find((quote) => quote.venueId === round.buyVenue)
    const sell = scenario.quotes.find((quote) => quote.venueId === round.sellVenue)
    const fees = ((buy?.feeRate ?? 0) + (sell?.feeRate ?? 0)) * 100
    return {
      valuePercent,
      title: 'Комиссии оказались выше ценового расхождения',
      detail: `Разница ${formatEdge(round.grossReturn * 100)}, комиссии ${formatNumber(fees, 2)}%`,
    }
  }

  return {
    valuePercent,
    title: 'Не хватило ликвидности: часть объёма исполнилась хуже',
    detail: `Меньший размер сохранил бы ${formatEdge(round.netBeforeLiquidity * 100)} на единицу`,
  }
}

/** 1–2 наблюдения о поведении без оценки квалификации. */
export function arbitrageObservations(result: CrossArbitrageResult): string[] {
  const observations: string[] = []
  const { rounds } = result
  const trades = rounds.filter((round) => !round.choseNoTrade)
  const feeTraps = trades.filter(
    (round) => round.grossReturn > 0 && round.netBeforeLiquidity <= 0,
  ).length
  const wrongPairs = trades.filter((round) => round.grossReturn <= 0).length
  const fast = result.averageDecisionMs < 7000

  if (result.found > 0 && feeTraps > 0) {
    const times = feeTraps === 1 ? 'один раз' : `${feeTraps} ${plural(feeTraps, ['раз', 'раза', 'раз'])}`
    observations.push(
      `Ты ${fast ? 'быстро находил' : 'находил'} крупные расхождения, но ${times} вошёл в сделку, где комиссии полностью съели edge.`,
    )
  } else if (result.missed > 0 && result.falseTrades === 0) {
    observations.push(
      'Ты пропустил часть возможностей, зато ни разу не вошёл в отрицательную после комиссий сделку.',
    )
  } else if (result.found === result.opportunities && result.falseTrades === 0) {
    observations.push(
      'Ты нашёл все возможности и ни разу не вошёл в сделку, которая после комиссий уходила в минус.',
    )
  } else if (wrongPairs > 0) {
    observations.push(
      'Часть сделок пришлась на пары, где продажа была дешевле покупки: расхождение было между другими площадками.',
    )
  } else if (feeTraps > 0) {
    observations.push('Ты входил в сделки, где разница в цене не перекрывала комиссии обеих площадок.')
  } else if (trades.some((round) => round.netBeforeLiquidity <= 0 && round.quoteStep > 0)) {
    observations.push('В части сделок edge закрылся раньше, чем сделка была собрана.')
  }

  const liquidityLosses = trades.filter((round) => round.liquidityHit && round.netReturn < round.netBeforeLiquidity)
  if (liquidityLosses.length) {
    observations.unshift(`${liquidityLosses.length === 1 ? 'В одной сделке' : `В ${liquidityLosses.length} сделках`} объём превысил ликвидность по лучшей цене: часть edge ушла на исполнение второго уровня.`)
  }

  const sized = trades.filter((round) => round.grossReturn > 0)
  if (sized.length >= 2) {
    const sizes = new Set(sized.map((round) => round.positionSize))
    const correlation = pearson(
      sized.map((round) => round.grossReturn),
      sized.map((round) => round.positionSize),
    )
    if (sizes.size === 1) {
      observations.push(
        `Ты торговал одним размером — ${sizeLabel(sized[0].positionSize)} — независимо от величины расхождения.`,
      )
    } else if (correlation > 0.3) {
      observations.push(
        'Ты чаще выбирал более крупный размер позиции, когда разница между площадками увеличивалась.',
      )
    } else if (correlation < -0.3) {
      observations.push(
        'Крупный размер чаще приходился на небольшие расхождения, а на крупных ты торговал осторожнее.',
      )
    }
  }

  const timeouts = rounds.filter((round) => round.timedOut).length
  if (observations.length < 2 && timeouts > 0) {
    observations.push(
      `${timeouts === 1 ? 'Один раз' : `${timeouts} ${plural(timeouts, ['раз', 'раза', 'раз'])}`} время вышло раньше решения — сделка не открывалась.`,
    )
  }

  return observations.slice(0, 2)
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let i = 0; i < n; i += 1) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY)
    varianceX += (xs[i] - meanX) ** 2
    varianceY += (ys[i] - meanY) ** 2
  }
  if (varianceX === 0 || varianceY === 0) return 0
  return covariance / Math.sqrt(varianceX * varianceY)
}

/* ------------------------------------------------------------------ */
/* Trading Profile                                                     */
/* ------------------------------------------------------------------ */

export interface CrossArbitrageTraits {
  opportunity: number
  discipline: number
  adaptability: number
}

export function crossArbitrageTraits(result: CrossArbitrageResult): CrossArbitrageTraits {
  const { rounds } = result

  // Поиск возможностей: какую долю доступного net edge игрок забрал.
  const opportunityRounds = rounds.filter((round) => round.optimalNetReturn > 0)
  const available = opportunityRounds.reduce((sum, round) => sum + round.optimalNetReturn, 0)
  const captured = opportunityRounds.reduce(
    (sum, round) => sum + Math.max(0, round.capitalReturn),
    0,
  )
  const opportunity = opportunityRounds.length
    ? (clamp(captured / available, 0, 1) * 0.65 +
        (result.found / opportunityRounds.length) * 0.35) *
      100
    : 50

  // Дисциплина: правильные «Сделки нет» и отсутствие убыточных сделок.
  const emptyRounds = rounds.length - opportunityRounds.length
  const passRatio = emptyRounds > 0 ? result.correctPasses / emptyRounds : 1
  const falseRatio = result.tradeCount > 0 ? result.falseTrades / result.tradeCount : 0
  const discipline = (passRatio * 0.55 + (1 - falseRatio) * 0.45) * 100

  // Адаптивность: скорость и успел ли игрок до схождения котировок.
  const decided = rounds.filter((round) => !round.timedOut)
  const averageMs = decided.length
    ? decided.reduce((sum, round) => sum + round.decisionTimeMs, 0) / decided.length
    : 15000
  const timeouts = rounds.length - decided.length
  const speedScore = mapRange(averageMs, 11000, 3500, 30, 95) - timeouts * 12
  const closingRounds = rounds.filter(
    (round) => round.msBeforeClose !== undefined && round.optimalNetReturn > 0,
  )
  const windowScore = closingRounds.length
    ? (closingRounds.filter((round) => round.profitable).length / closingRounds.length) * 100
    : 60
  const adaptability = speedScore * 0.7 + windowScore * 0.3

  return {
    opportunity: clamp(opportunity, 0, 100),
    discipline: clamp(discipline, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
  }
}

export function crossArbitrageSentence(result: CrossArbitrageResult): string {
  if (result.falseTrades === 0 && result.missed === 0) {
    return 'В кросс-арбитраже ты собрал все расхождения, которые переживали комиссии, и не вошёл ни в одну сделку, где их не хватало.'
  }
  if (result.falseTrades === 0) {
    return 'В кросс-арбитраже ты торговал только там, где разница переживала комиссии, даже ценой пропущенных возможностей.'
  }
  if (result.missed === 0) {
    return 'В кросс-арбитраже ты не пропустил ни одной возможности, но часть сделок после комиссий уходила в минус.'
  }
  return 'В кросс-арбитраже ты входил в сделки выборочно: часть возможностей пропустил, а часть сделок съели издержки.'
}
