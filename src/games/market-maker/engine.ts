import {
  MM_HEDGE_COST_PER_UNIT,
  MM_INITIAL_SPREAD,
  MM_MARKOUT_TICKS,
  MM_MAX_SPREAD,
  MM_MIN_SPREAD,
  MM_QUOTE_STEP,
  MM_TICK_MS,
} from '@/data/marketMakerScenarios'
import { clamp, createRandom, type SeededRandom } from '@/lib/random'
import type { MarketMakerResult, MarketMakerScenario, MMTrade } from '@/types/game'
import { decideBotOrder } from './bots'
import { marketMakerScore } from './scoring'

export interface MarketMakerSnapshot {
  tick: number
  totalTicks: number
  secondsLeft: number
  bid: number
  ask: number
  spread: number
  inventory: number
  pnl: number
  trades: MMTrade[]
  quoteHistory: { tick: number; bid: number; ask: number }[]
  hedgeCount: number
  finished: boolean
}

export class MarketMakerEngine {
  readonly scenario: MarketMakerScenario
  readonly totalTicks: number

  private readonly fairValuePath: number[]
  private readonly botRandom: SeededRandom

  private tickIndex = 0
  private center: number
  private spread = MM_INITIAL_SPREAD
  private inventory = 0
  private cash = 0
  private hedgeCostTotal = 0

  private trades: MMTrade[] = []
  private quoteHistory: { tick: number; bid: number; ask: number }[] = []

  private maxInventory = 0
  private hedgeCount = 0
  private spreadChanges = 0
  private quoteMoves = 0
  private spreadSamples: number[] = []

  constructor(scenario: MarketMakerScenario) {
    this.scenario = scenario
    this.totalTicks = Math.round((scenario.durationSeconds * 1000) / MM_TICK_MS)
    this.center = scenario.initialFairValue

    // Путь справедливой цены считается целиком заранее: это делает раунд
    // детерминированным и позволяет информированному боту «знать будущее».
    this.fairValuePath = buildFairValuePath(
      scenario.seed,
      scenario.initialFairValue,
      scenario.volatility,
      this.totalTicks + MM_MARKOUT_TICKS + 8,
    )

    // Отдельный поток случайности для бота, чтобы действия игрока
    // не сдвигали траекторию справедливой цены.
    this.botRandom = createRandom(scenario.seed ^ 0x5bf03635)
    this.quoteHistory.push({ tick: 0, bid: this.bid, ask: this.ask })
  }

  get fairValue(): number {
    return this.fairValuePath[Math.min(this.tickIndex, this.fairValuePath.length - 1)]
  }

  get bid(): number {
    return round2(this.center - this.spread / 2)
  }

  get ask(): number {
    return round2(this.center + this.spread / 2)
  }

  get pnl(): number {
    return this.cash + this.inventory * this.fairValue - this.hedgeCostTotal
  }

  get finished(): boolean {
    return this.tickIndex >= this.totalTicks
  }

  /* ---------------------------- управление ---------------------------- */

  moveQuotes(direction: 1 | -1): void {
    if (this.finished) return
    this.center = round2(this.center + direction * MM_QUOTE_STEP)
    this.quoteMoves += 1
  }

  narrowSpread(): void {
    if (this.finished) return
    const next = round2(this.spread - MM_QUOTE_STEP)
    if (next < MM_MIN_SPREAD) return
    this.spread = next
    this.spreadChanges += 1
  }

  widenSpread(): void {
    if (this.finished) return
    const next = round2(this.spread + MM_QUOTE_STEP)
    if (next > MM_MAX_SPREAD) return
    this.spread = next
    this.spreadChanges += 1
  }

  /** Закрывает весь инвентарь по справедливой цене с небольшой комиссией. */
  hedge(): number {
    if (this.finished || this.inventory === 0) return 0
    const closed = this.inventory
    this.cash += closed * this.fairValue
    this.hedgeCostTotal += Math.abs(closed) * MM_HEDGE_COST_PER_UNIT
    this.inventory = 0
    this.hedgeCount += 1
    return closed
  }

  /* ------------------------------- цикл ------------------------------- */

  tick(): MarketMakerSnapshot {
    if (this.finished) return this.snapshot()

    this.tickIndex += 1
    this.spreadSamples.push(this.spread)

    const bid = this.bid
    const ask = this.ask

    const order = decideBotOrder(this.scenario.botType, {
      random: this.botRandom,
      tick: this.tickIndex,
      fairValuePath: this.fairValuePath,
      bid,
      ask,
    })

    if (order) {
      const price = order.side === 'buy' ? ask : bid
      const fairValueAtTrade = this.fairValue
      const fairValueLater =
        this.fairValuePath[
          Math.min(this.tickIndex + MM_MARKOUT_TICKS, this.fairValuePath.length - 1)
        ]

      // Бот покупает по ask → маркет-мейкер продаёт, и наоборот.
      const userDirection = order.side === 'buy' ? -1 : 1
      this.inventory += userDirection * order.size
      this.cash -= userDirection * order.size * price

      const markout = userDirection * (fairValueLater - price) * order.size

      this.trades.push({
        tick: this.tickIndex,
        botSide: order.side,
        size: order.size,
        price,
        fairValueAtTrade,
        markout,
      })

      this.maxInventory = Math.max(this.maxInventory, Math.abs(this.inventory))
    }

    this.quoteHistory.push({ tick: this.tickIndex, bid, ask })

    return this.snapshot()
  }

  snapshot(): MarketMakerSnapshot {
    const remainingTicks = Math.max(0, this.totalTicks - this.tickIndex)
    return {
      tick: this.tickIndex,
      totalTicks: this.totalTicks,
      secondsLeft: Math.ceil((remainingTicks * MM_TICK_MS) / 1000),
      bid: this.bid,
      ask: this.ask,
      spread: round2(this.spread),
      inventory: this.inventory,
      pnl: this.pnl,
      trades: this.trades,
      quoteHistory: this.quoteHistory,
      hedgeCount: this.hedgeCount,
      finished: this.finished,
    }
  }

  buildResult(): MarketMakerResult {
    const half = Math.ceil(this.spreadSamples.length / 2) || 1
    const firstHalf = this.spreadSamples.slice(0, half)
    const secondHalf = this.spreadSamples.slice(half)

    const adverseSelectionLoss = this.trades.reduce(
      (sum, trade) => sum + Math.max(0, -trade.markout),
      0,
    )

    const grossEdge = this.trades.reduce((sum, trade) => {
      const edgePerUnit =
        trade.botSide === 'buy'
          ? trade.price - trade.fairValueAtTrade
          : trade.fairValueAtTrade - trade.price
      return sum + edgePerUnit * trade.size
    }, 0)

    const averageSpread = mean(this.spreadSamples, MM_INITIAL_SPREAD)

    const result: Omit<MarketMakerResult, 'score'> = {
      scenarioId: this.scenario.id,
      seed: this.scenario.seed,
      botType: this.scenario.botType,
      pnl: this.pnl,
      maxInventory: this.maxInventory,
      tradeCount: this.trades.length,
      averageSpread,
      adverseSelectionLoss,
      grossEdge,
      hedgeCount: this.hedgeCount,
      finalInventory: this.inventory,
      spreadChanges: this.spreadChanges,
      quoteMoves: this.quoteMoves,
      spreadFirstHalf: mean(firstHalf, averageSpread),
      spreadSecondHalf: mean(secondHalf, averageSpread),
    }

    return { ...result, score: marketMakerScore(result) }
  }
}

/** Seeded random walk справедливой цены. */
export function buildFairValuePath(
  seed: number,
  initialValue: number,
  volatility: number,
  length: number,
): number[] {
  const random = createRandom(seed)
  const path: number[] = [initialValue]
  let value = initialValue

  // Медленно меняющийся дрейф даёт «режимы» рынка вместо чистого шума.
  let drift = 0

  for (let i = 1; i < length; i += 1) {
    drift = clamp(drift * 0.93 + random.normal(0, volatility * 0.32), -volatility * 2, volatility * 2)
    value = round2(value + drift + random.normal(0, volatility))
    path.push(value)
  }

  return path
}

function mean(values: number[], fallback: number): number {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
