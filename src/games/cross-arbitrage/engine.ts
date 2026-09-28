import { createRandom } from '@/lib/random'
import type { ArbitrageVenueQuote, CrossArbitrageScenario } from '@/types/game'

export const ARB_DECISION_SECONDS = 15
export const ARB_POSITION_SIZES = [0.25, 0.5, 0.75, 1] as const
/** 100% размера = 100 единиц актива. */
export const ARB_FULL_SIZE_UNITS = 100
/** Объём сверх доступной ликвидности исполняется на 0,10% хуже на каждой такой ноге. */
export const ARB_LIQUIDITY_PENALTY = 0.001

export const ARB_CONVERGENCE_DELAY_MS = 3000
export const ARB_QUOTE_STEP_MS = 2500
export const ARB_CONVERGENCE_STEPS = 5
/**
 * Net edge исходно лучшей пары на последнем шаге — доля от исходного edge со
 * знаком минус. Перелёт нужен, чтобы окно закрывалось до последнего шага.
 */
const ARB_CONVERGENCE_OVERSHOOT = 0.4

export interface TradeOutcome {
  buyVenue: string
  sellVenue: string
  positionSize: number
  grossReturn: number
  /** Net edge на единицу только с учётом комиссий. */
  netBeforeLiquidity: number
  /** Net edge на единицу с учётом ухудшенного исполнения сверх ликвидности. */
  netReturn: number
  capitalReturn: number
  liquidityHit: boolean
}

function findQuote(quotes: ArbitrageVenueQuote[], venueId: string): ArbitrageVenueQuote {
  const found = quotes.find((quote) => quote.venueId === venueId)
  if (!found) throw new Error(`Unknown venue: ${venueId}`)
  return found
}

/** Доля объёма, которая не помещается в ликвидность площадки. */
function excessShare(quote: ArbitrageVenueQuote, units: number): number {
  if (quote.availableLiquidity === undefined || units <= quote.availableLiquidity) return 0
  return (units - quote.availableLiquidity) / units
}

/** Покупка по ask, продажа по bid, комиссия на каждой ноге. */
export function evaluateTrade(
  quotes: ArbitrageVenueQuote[],
  buyVenue: string,
  sellVenue: string,
  positionSize: number,
): TradeOutcome {
  const buy = findQuote(quotes, buyVenue)
  const sell = findQuote(quotes, sellVenue)

  const grossProfit = sell.bid - buy.ask
  const buyFee = buy.ask * buy.feeRate
  const sellFee = sell.bid * sell.feeRate
  const netProfit = sell.bid - sellFee - buy.ask - buyFee

  const grossReturn = grossProfit / buy.ask
  const netBeforeLiquidity = netProfit / buy.ask

  const units = positionSize * ARB_FULL_SIZE_UNITS
  const excess = excessShare(buy, units) + excessShare(sell, units)
  const netReturn = netBeforeLiquidity - excess * ARB_LIQUIDITY_PENALTY

  return {
    buyVenue,
    sellVenue,
    positionSize,
    grossReturn,
    netBeforeLiquidity,
    netReturn,
    capitalReturn: netReturn * positionSize,
    liquidityHit: excess > 0,
  }
}

/** Все пары buy ≠ sell при полном размере. */
export function listRoutes(quotes: ArbitrageVenueQuote[]): TradeOutcome[] {
  const routes: TradeOutcome[] = []
  for (const buy of quotes) {
    for (const sell of quotes) {
      if (buy.venueId === sell.venueId) continue
      routes.push(evaluateTrade(quotes, buy.venueId, sell.venueId, 1))
    }
  }
  return routes
}

/** Лучшая сделка по всем парам и размерам — именно с ней сравнивается игрок. */
export function bestTrade(quotes: ArbitrageVenueQuote[]): TradeOutcome {
  let best: TradeOutcome | null = null
  for (const buy of quotes) {
    for (const sell of quotes) {
      if (buy.venueId === sell.venueId) continue
      for (const size of ARB_POSITION_SIZES) {
        const outcome = evaluateTrade(quotes, buy.venueId, sell.venueId, size)
        if (!best || outcome.capitalReturn > best.capitalReturn + 1e-12) best = outcome
      }
    }
  }
  return best as TradeOutcome
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Котировки по шагам. Для dynamic-сценария лучшая пара сходится так, чтобы
 * к последнему шагу её net edge стал отрицательным. Движение задаёт только
 * seed, поэтому shared-ссылка воспроизводит те же обновления.
 */
export function buildQuotePath(scenario: CrossArbitrageScenario): ArbitrageVenueQuote[][] {
  if (!scenario.dynamic) return [scenario.quotes]

  const random = createRandom(scenario.seed)
  const best = bestTrade(scenario.quotes)
  const buy = findQuote(scenario.quotes, best.buyVenue)
  const sell = findQuote(scenario.quotes, best.sellVenue)

  const netProfit = best.netBeforeLiquidity * buy.ask
  const toClose = netProfit * (1 + ARB_CONVERGENCE_OVERSHOOT)
  const sellShare = random.range(0.4, 0.65)
  const sellShift = (toClose * sellShare) / (1 - sell.feeRate)
  const buyShift = (toClose * (1 - sellShare)) / (1 + buy.feeRate)

  const weights = Array.from({ length: ARB_CONVERGENCE_STEPS }, () => random.range(0.7, 1.3))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  const path: ArbitrageVenueQuote[][] = [scenario.quotes]
  let cumulative = 0
  for (const weight of weights) {
    cumulative += weight / totalWeight
    path.push(
      scenario.quotes.map((quote) => {
        const shift =
          quote.venueId === sell.venueId
            ? -sellShift * cumulative
            : quote.venueId === buy.venueId
              ? buyShift * cumulative
              : 0
        if (shift === 0) return quote
        return { ...quote, bid: roundPrice(quote.bid + shift), ask: roundPrice(quote.ask + shift) }
      }),
    )
  }
  return path
}

/** Какой шаг котировок виден через elapsedMs после их появления. */
export function quoteStepAt(elapsedMs: number, pathLength: number): number {
  if (pathLength <= 1 || elapsedMs < ARB_CONVERGENCE_DELAY_MS) return 0
  const step = 1 + Math.floor((elapsedMs - ARB_CONVERGENCE_DELAY_MS) / ARB_QUOTE_STEP_MS)
  return Math.min(pathLength - 1, step)
}

export function stepStartMs(step: number): number {
  if (step <= 0) return 0
  return ARB_CONVERGENCE_DELAY_MS + (step - 1) * ARB_QUOTE_STEP_MS
}

/**
 * Момент, когда исходно лучшая пара перестаёт быть прибыльной.
 * null — окно не закрывается (статичный рынок или возможности не было).
 */
export function windowCloseMs(
  scenario: CrossArbitrageScenario,
  path: ArbitrageVenueQuote[][],
): number | null {
  if (path.length <= 1) return null
  const initial = bestTrade(scenario.quotes)
  if (initial.capitalReturn <= 0) return null

  for (let step = 1; step < path.length; step += 1) {
    const outcome = evaluateTrade(path[step], initial.buyVenue, initial.sellVenue, 1)
    if (outcome.netBeforeLiquidity <= 0) return stepStartMs(step)
  }
  return null
}
