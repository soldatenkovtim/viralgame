import { createRandom } from '@/lib/random'
import type { ArbitrageVenueQuote, CrossArbitrageScenario } from '@/types/game'

export const ARB_DECISION_SECONDS = 15
export const ARB_POSITION_SIZES = [0.1, 0.25, 0.5, 1] as const
/** 100% размера = 100 единиц актива. */
export const ARB_FULL_SIZE_UNITS = 100

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
  avgBuyPrice: number
  avgSellPrice: number
  feeReturn: number
  slippageReturn: number
}

function findQuote(quotes: ArbitrageVenueQuote[], venueId: string): ArbitrageVenueQuote {
  const found = quotes.find((quote) => quote.venueId === venueId)
  if (!found) throw new Error(`Unknown venue: ${venueId}`)
  return found
}

/** Два уровня: неизвестная глубина не считается бесконечной ликвидностью. */
export function executionPrice(quote: ArbitrageVenueQuote, side: 'buy' | 'sell', units: number): number {
  const best = side === 'buy' ? quote.ask : quote.bid
  const liquidity = side === 'buy' ? quote.askLiquidity : quote.bidLiquidity
  const second = side === 'buy' ? quote.secondAsk : quote.secondBid
  const secondLiquidity = side === 'buy' ? quote.secondAskLiquidity : quote.secondBidLiquidity
  if (!Number.isFinite(units) || units <= 0) throw new Error('Invalid trade size')
  if (units <= liquidity) return best
  if (second === undefined || units > liquidity + (secondLiquidity ?? 0)) {
    throw new Error('Insufficient depth')
  }
  return (liquidity * best + (units - liquidity) * second) / units
}

/** Комиссии начисляются на фактическую стоимость исполнения каждой ноги. */
export function evaluateTrade(
  quotes: ArbitrageVenueQuote[], buyVenue: string, sellVenue: string, positionSize: number,
): TradeOutcome {
  if (buyVenue === sellVenue) throw new Error('Buy and sell venues must differ')
  const buy = findQuote(quotes, buyVenue)
  const sell = findQuote(quotes, sellVenue)
  const units = positionSize * ARB_FULL_SIZE_UNITS
  const avgBuyPrice = executionPrice(buy, 'buy', units)
  const avgSellPrice = executionPrice(sell, 'sell', units)
  const grossReturn = (sell.bid - buy.ask) / buy.ask
  const netBeforeLiquidity = grossReturn - (buy.ask * buy.feeRate + sell.bid * sell.feeRate) / buy.ask
  const feeReturn = (avgBuyPrice * buy.feeRate + avgSellPrice * sell.feeRate) / buy.ask
  const slippageReturn = (avgBuyPrice - buy.ask + sell.bid - avgSellPrice) / buy.ask
  const netReturn = grossReturn - feeReturn - slippageReturn
  return {
    buyVenue, sellVenue, positionSize, grossReturn, netBeforeLiquidity, netReturn,
    capitalReturn: netReturn * positionSize,
    liquidityHit: units > buy.askLiquidity || units > sell.bidLiquidity,
    avgBuyPrice, avgSellPrice, feeReturn, slippageReturn,
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
        return {
          ...quote, bid: roundPrice(quote.bid + shift), ask: roundPrice(quote.ask + shift),
          ...(quote.secondBid !== undefined ? { secondBid: roundPrice(quote.secondBid + shift) } : {}),
          ...(quote.secondAsk !== undefined ? { secondAsk: roundPrice(quote.secondAsk + shift) } : {}),
        }
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
