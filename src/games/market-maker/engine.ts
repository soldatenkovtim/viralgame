import {
  MM_HEDGE_COST_PER_UNIT,
  MM_HEDGE_TICKET_FEE,
  MM_INITIAL_SPREAD,
  MM_LOT_SIZE,
  MM_MARKOUT_TICKS,
  MM_MAX_SPREAD,
  MM_MIN_SPREAD,
  MM_QUOTE_STEP,
  MM_MAX_QUOTE_OFFSET_RATIO,
  MM_TRANSACTION_COST_PER_UNIT,
  MM_SOFT_INVENTORY_LIMIT,
  MM_TICK_MS,
} from '@/data/marketMakerScenarios'
import { createRandom, type SeededRandom } from '@/lib/random'
import type {
  MMAccountingDebug,
  MarketMakerResult,
  MarketMakerScenario,
  MMPhaseStats,
  MMTickPoint,
  MMTrade,
} from '@/types/game'
import { decideFlowOrder, INFORMED_LOOKAHEAD } from './bots'
import { buildMarketPaths, phaseAt, ticksFor, tickToSeconds } from './market'
import { marketMakerScore } from './scoring'
import { MarketMakerAccount } from './accounting'

/** С какого размера inventory считается, что игроку пора реагировать. */
const RESPONSE_TRIGGER = 10
/** Вес последней сделки в перекосе потока. */
const IMBALANCE_WEIGHT = 0.25

export interface QuotePoint {
  tick: number
  marketPrice: number
  bid: number
  ask: number
}

/** Всё, что игрок видит во время раунда. Справедливой цены здесь нет. */
export interface MarketMakerSnapshot {
  tick: number
  totalTicks: number
  secondsLeft: number
  bid: number
  ask: number
  spread: number
  marketPrice: number
  inventory: number
  pnl: number
  accounting: MMAccountingDebug
  hedgeCostPreview: number
  trades: MMTrade[]
  history: QuotePoint[]
  hedgeCount: number
  finished: boolean
}

interface PhaseAccumulator {
  fills: number
  spreadSum: number
  lagSum: number
  ticks: number
  adverseLoss: number
  pnlStart: number | null
  pnlEnd: number
}

export class MarketMakerEngine {
  readonly scenario: MarketMakerScenario
  readonly totalTicks: number

  private readonly fairValuePath: number[]
  private readonly marketPath: number[]
  private readonly flowRandom: SeededRandom

  private tickIndex = 0
  private center: number
  private spread = MM_INITIAL_SPREAD
  private readonly account = new MarketMakerAccount()

  private get inventory(): number {
    return this.account.inventory / MM_LOT_SIZE
  }

  /** Все денежные величины — в деньгах, уже умноженные на размер лота. */
  private spreadPnl = 0
  private inventoryMtm = 0

  private trades: MMTrade[] = []
  private history: QuotePoint[] = []
  private timeline: MMTickPoint[] = []

  private maxInventory = 0
  private hedgeCount = 0
  private hedgedUnits = 0
  private spreadChanges = 0
  private quoteMoves = 0
  private spreadSamples: number[] = []
  private ticksAboveSoft = 0

  /** Экспоненциально сглаженный перекос сторон последних сделок, от −1 до 1. */
  private flowImbalance = 0

  private responseStart: number | null = null
  private responseDelays: number[] = []

  private readonly phaseStats: PhaseAccumulator[]

  constructor(scenario: MarketMakerScenario) {
    this.scenario = scenario
    this.totalTicks = ticksFor(scenario.durationSeconds)
    this.center = scenario.initialFairValue

    const paths = buildMarketPaths(
      scenario,
      this.totalTicks + Math.max(MM_MARKOUT_TICKS, INFORMED_LOOKAHEAD) + 2,
    )
    this.fairValuePath = paths.fairValue
    this.marketPath = paths.marketPrice

    // Отдельный поток случайности для контрагентов: действия игрока
    // не сдвигают траекторию цены.
    this.flowRandom = createRandom(scenario.seed ^ 0x5bf03635)

    this.phaseStats = scenario.flowPhases.map(() => ({
      fills: 0,
      spreadSum: 0,
      lagSum: 0,
      ticks: 0,
      adverseLoss: 0,
      pnlStart: null,
      pnlEnd: 0,
    }))

    this.recordPoint()
  }

  get bid(): number {
    return round2(this.center - this.spread / 2)
  }

  get ask(): number {
    return round2(this.center + this.spread / 2)
  }

  get marketPrice(): number {
    return this.marketPath[this.tickIndex]
  }

  /** Cumulative price movement after fills, including positions closed by hedges. */
  get inventoryPnl(): number {
    return this.inventoryMtm
  }

  get pnl(): number {
    return this.account.totalPnl(this.marketPrice)
  }

  private accounting(): MMAccountingDebug {
    return {
      cash: this.account.cash,
      initialCapital: this.account.initialCapital,
      inventoryUnits: this.account.inventory,
      averageEntry: this.account.averageEntry,
      markPrice: this.marketPrice,
      openInventoryPnl: this.account.openInventoryPnl(this.marketPrice),
      realizedPnl: this.account.realizedPnl,
      transactionCosts: this.account.transactionCosts,
      hedgeCosts: this.account.hedgeCosts,
      carryCosts: this.account.carryCosts,
      totalPnl: this.pnl,
    }
  }

  get finished(): boolean {
    return this.tickIndex >= this.totalTicks
  }

  /* ---------------------------- управление ---------------------------- */

  /** Сдвигает bid и ask одновременно. Рынок от этого не двигается. */
  moveQuotes(direction: 1 | -1): void {
    if (this.finished) return
    const next = this.boundedCenter(this.center + direction * MM_QUOTE_STEP)
    if (next === this.center) return
    this.center = next
    this.quoteMoves += 1
    // Сдвиг против позиции — реакция на inventory: лонг сдвигает ниже, шорт — выше.
    if (Math.sign(this.inventory) === -direction) this.closeResponse()
  }

  narrowSpread(): void {
    if (this.finished) return
    const next = round2(this.spread - MM_QUOTE_STEP)
    if (next < MM_MIN_SPREAD - 1e-9) return
    this.spread = next
    this.spreadChanges += 1
  }

  widenSpread(): void {
    if (this.finished) return
    const next = round2(this.spread + MM_QUOTE_STEP)
    if (next > MM_MAX_SPREAD + 1e-9) return
    this.spread = next
    this.spreadChanges += 1
  }

  /** Закрывает весь inventory по рыночной цене. Возвращает закрытый объём. */
  hedge(): number {
    if (this.finished || this.inventory === 0) return 0
    const closed = this.inventory
    // Settle the position into cash at mark; charge the hedge fee exactly once.
    this.account.hedge(this.marketPrice, this.hedgeCostFor(closed))
    this.hedgedUnits += Math.abs(closed)
    this.hedgeCount += 1
    this.closeResponse()
    return closed
  }

  hedgeCostFor(units: number): number {
    if (units === 0) return 0
    return (Math.abs(units) * MM_HEDGE_COST_PER_UNIT * MM_LOT_SIZE + MM_HEDGE_TICKET_FEE) * (this.scenario.hedgeCostMultiplier ?? 1)
  }

  /* ------------------------------- цикл ------------------------------- */

  tick(): MarketMakerSnapshot {
    if (this.finished) return this.snapshot()

    const pnlBefore = this.pnl
    this.tickIndex += 1
    const tick = this.tickIndex
    const market = this.marketPath[tick]
    this.center = this.boundedCenter(this.center)
    const fairValue = this.fairValuePath[tick]
    const phaseIndex = this.flowPhaseIndex(tick)
    const regime = this.scenario.flowPhases[phaseIndex].regime
    const phase = this.phaseStats[phaseIndex]
    if (phase.pnlStart === null) phase.pnlStart = pnlBefore

    this.inventoryMtm += this.inventory * (market - this.marketPath[tick - 1]) * MM_LOT_SIZE
    this.account.chargeCarry(Math.max(0, Math.abs(this.inventory) - (this.scenario.softInventoryLimit ?? MM_SOFT_INVENTORY_LIMIT)) * (this.scenario.inventoryCarryCost ?? 0) * MM_LOT_SIZE)
    this.spreadSamples.push(this.spread)

    const bid = this.bid
    const ask = this.ask
    const order = decideFlowOrder(regime, {
      random: this.flowRandom,
      tick,
      fairValue: this.fairValuePath,
      marketPrice: this.marketPath,
      bid,
      ask,
      intensity: this.scenario.flowPhases[phaseIndex].intensity ?? 1,
      imbalance: this.flowImbalance,
    })

    if (order) {
      this.flowImbalance =
        this.flowImbalance * (1 - IMBALANCE_WEIGHT) +
        (order.side === 'buy' ? 1 : -1) * IMBALANCE_WEIGHT

      const price = order.side === 'buy' ? ask : bid
      // Контрагент покупает по ask → маркет-мейкер продаёт, и наоборот.
      const userDirection = order.side === 'buy' ? -1 : 1
      const before = this.inventory
      this.account.execute(
        userDirection * order.size * MM_LOT_SIZE,
        price,
        order.size * MM_LOT_SIZE * MM_TRANSACTION_COST_PER_UNIT,
      )

      // Спред считается от рыночной цены в момент сделки;
      // дальнейшее движение позиции попадает в переоценку inventory.
      this.spreadPnl += userDirection * (market - price) * order.size * MM_LOT_SIZE

      // Markout от рыночной цены, а не от цены сделки: заработанный спред
      // учтён отдельно и не маскирует информированного контрагента.
      const fairValueLater = this.fairValuePath[tick + MM_MARKOUT_TICKS]
      const markout = userDirection * (fairValueLater - market) * order.size * MM_LOT_SIZE

      this.trades.push({
        tick,
        botSide: order.side,
        size: order.size,
        price,
        marketPriceAtTrade: market,
        fairValueAtTrade: fairValue,
        inventoryAfter: this.inventory,
        increasedRisk: Math.abs(this.inventory) > Math.abs(before),
        markout,
        regime,
      })

      phase.fills += 1
      phase.adverseLoss += Math.max(0, -markout)
      this.maxInventory = Math.max(this.maxInventory, Math.abs(this.inventory))

      if (Math.abs(before) < RESPONSE_TRIGGER && Math.abs(this.inventory) >= RESPONSE_TRIGGER) {
        this.responseStart ??= tick
      } else if (Math.abs(this.inventory) < RESPONSE_TRIGGER) {
        // Позиция рассосалась сама — это не реакция игрока.
        this.responseStart = null
      }
    }

    if (Math.abs(this.inventory) > (this.scenario.softInventoryLimit ?? MM_SOFT_INVENTORY_LIMIT)) this.ticksAboveSoft += 1

    phase.ticks += 1
    phase.spreadSum += this.spread
    phase.lagSum += Math.abs(this.center - fairValue)
    phase.pnlEnd = this.pnl

    this.recordPoint()

    if (this.finished && this.responseStart !== null) {
      this.responseDelays.push(tickToSeconds(this.totalTicks - this.responseStart))
      this.responseStart = null
    }

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
      marketPrice: this.marketPrice,
      inventory: this.inventory,
      pnl: this.pnl,
      accounting: this.accounting(),
      hedgeCostPreview: this.hedgeCostFor(this.inventory),
      trades: this.trades.slice(),
      history: this.history.slice(),
      hedgeCount: this.hedgeCount,
      finished: this.finished,
    }
  }

  buildResult(): MarketMakerResult {
    const half = Math.ceil(this.spreadSamples.length / 2) || 1
    const averageSpread = mean(this.spreadSamples, MM_INITIAL_SPREAD)

    const phases: MMPhaseStats[] = this.scenario.flowPhases.map((config, index) => {
      const stats = this.phaseStats[index]
      return {
        regime: config.regime,
        from: config.from,
        to: config.to,
        fills: stats.fills,
        averageSpread: stats.ticks ? stats.spreadSum / stats.ticks : averageSpread,
        adverseSelectionLoss: stats.adverseLoss,
        pnlChange: stats.pnlEnd - (stats.pnlStart ?? stats.pnlEnd),
        averageQuoteLag: stats.ticks ? stats.lagSum / stats.ticks : 0,
      }
    })

    const result: Omit<MarketMakerResult, 'score'> = {
      scenarioId: this.scenario.id,
      seed: this.scenario.seed,
      pnl: this.pnl,
      spreadPnl: this.spreadPnl,
      inventoryPnl: this.inventoryPnl,
      hedgeCosts: this.account.hedgeCosts,
      carryCosts: this.account.carryCosts,
      transactionCosts: this.account.transactionCosts,
      realizedPnl: this.account.realizedPnl,
      unrealizedPnl: this.account.openInventoryPnl(this.marketPrice),
      accounting: this.accounting(),
      maxInventory: this.maxInventory,
      tradeCount: this.trades.length,
      averageSpread,
      adverseSelectionLoss: this.trades.reduce((sum, trade) => sum + Math.max(0, -trade.markout), 0),
      hedgeCount: this.hedgeCount,
      hedgedUnits: this.hedgedUnits,
      finalInventory: this.inventory,
      spreadChanges: this.spreadChanges,
      quoteMoves: this.quoteMoves,
      secondsAboveSoftLimit: tickToSeconds(this.ticksAboveSoft),
      inventoryResponseSeconds: this.responseDelays.length ? mean(this.responseDelays, 0) : null,
      spreadFirstHalf: mean(this.spreadSamples.slice(0, half), averageSpread),
      spreadSecondHalf: mean(this.spreadSamples.slice(half), averageSpread),
      spreadNoise: weightedSpread(phases, (regime) => regime === 'noise', averageSpread),
      spreadDirectional: weightedSpread(phases, (regime) => regime !== 'noise', averageSpread),
      phases,
      timeline: this.timeline,
      trades: this.trades,
    }

    return { ...result, score: marketMakerScore(result) }
  }

  private flowPhaseIndex(tick: number): number {
    const phase = phaseAt(this.scenario.flowPhases, tick)
    return this.scenario.flowPhases.indexOf(phase)
  }

  private boundedCenter(center: number): number {
    const offset = this.marketPrice * MM_MAX_QUOTE_OFFSET_RATIO
    // Round the boundaries inward so cents cannot cross the displacement limit.
    const lower = Math.ceil((this.marketPrice - offset) * 100) / 100
    const upper = Math.floor((this.marketPrice + offset) * 100) / 100
    return Math.min(upper, Math.max(lower, round2(center)))
  }

  private closeResponse(): void {
    if (this.responseStart === null) return
    this.responseDelays.push(tickToSeconds(this.tickIndex - this.responseStart))
    this.responseStart = null
  }

  private recordPoint(): void {
    const tick = this.tickIndex
    const point = { tick, marketPrice: this.marketPath[tick], bid: this.bid, ask: this.ask }
    this.history.push(point)
    this.timeline.push({
      ...point,
      fairValue: this.fairValuePath[tick],
      inventory: this.inventory,
      pnl: this.pnl,
    })
  }
}

function weightedSpread(
  phases: MMPhaseStats[],
  match: (regime: MMPhaseStats['regime']) => boolean,
  fallback: number,
): number {
  let weight = 0
  let sum = 0
  for (const phase of phases) {
    if (!match(phase.regime)) continue
    const span = phase.to - phase.from
    weight += span
    sum += phase.averageSpread * span
  }
  return weight ? sum / weight : fallback
}

function mean(values: number[], fallback: number): number {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
