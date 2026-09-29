import type { BaseScenario } from '@/scenario-engine/scenarioTypes'
export type { GameMode, ChallengeContext, ScenarioDifficultyConfig } from '@/modes/config'
import type { TimeframeId } from '@/games/blind-market/timeframes'

export type ChallengeType =
  | 'blind-market'
  | 'market-maker'
  | 'black-swan'
  | 'cross-arbitrage'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface OhlcvCandle extends Candle {
  volume: number
}

export interface ChallengeResult {
  challengeType: ChallengeType
  scenarioId: string
  score: number
  rawScore?: number
  normalizedScore?: number
  mode?: 'standard' | 'advanced'
  completedAt: string
}

export interface TradingProfile {
  marketSense: number
  riskControl: number
  pricing: number
  adaptability: number
  discipline: number
  opportunity: number
  archetype: string
  description: string
}

/* ------------------------------------------------------------------ */
/* Blind Market                                                        */
/* ------------------------------------------------------------------ */

export type BlindInfoKey =
  | 'volume'
  | 'volatility'
  | 'correlation'
  | 'marketContext'
  | 'sector'

export type BlindDirection = 'long' | 'short' | 'flat'

export type BlindFollowUpAction =
  | 'increase'
  | 'hold'
  | 'reduce'
  | 'close'
  | 'flip'
  | 'enter-long'
  | 'enter-short'
  | 'stay-flat'

export interface BlindDecision {
  /** 0 — вход, 1 и 2 — реакции на развитие рынка. */
  checkpointIndex: number
  direction: BlindDirection
  action?: BlindFollowUpAction
  /** Экспозиция после решения: −1 … 1, где знак = направление. */
  exposure: number
  confidence: number
  priceAtDecision: number
  /** Стоп, действующий на отрезке после решения. */
  stopPrice?: number
  /** Миллисекунды на обдумывание. */
  timeMs: number
}

/** Точка на графике: время в секундах (может быть дробным внутри свечи) и цена. */
export interface ChartPoint {
  time: number
  price: number
}

export interface ChartLevel {
  id: string
  price: number
}

export interface ChartTrendLine {
  id: string
  a: ChartPoint
  b: ChartPoint
}

/** Пользовательская разметка — живёт весь сценарий и попадает в итоговый replay. */
export interface ChartAnnotations {
  levels: ChartLevel[]
  trendLine: ChartTrendLine | null
}

export interface BlindStopHit {
  /** Отрезок между точками решений, на котором сработал стоп. */
  segment: number
  candleIndex: number
  price: number
}

export interface BlindMarketResult {
  scenarioId: string
  seed: number
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  selectedInformation: BlindInfoKey[]
  decisions: BlindDecision[]
  averageConfidence: number
  directionChanges: number
  timeToDecision: number[]
  segmentReturns: number[]
  score: number
  stopHits?: BlindStopHit[]
  annotations?: ChartAnnotations
}

export interface BlindMarketScenario extends BaseScenario {
  id: string
  title: string
  seed: number
  hiddenAssetLabel: string
  startTime: string
  endTime: string
  baseTimeframe: TimeframeId
  availableTimeframes: TimeframeId[]
  internalTags: string[]
  sourceUrl: string
  /** Базовые исторические OHLCV; старшие таймфреймы агрегируются из них. */
  candles: OhlcvCandle[]
  /** Индексы свечей, на которых рынок останавливается для решения. */
  checkpoints: number[]
  /** Реальный актив раскрывается только в конце. */
  asset: {
    name: string
    ticker: string
    assetClass: 'equity' | 'index' | 'crypto' | 'commodity' | 'fx'
    exchange: string
  }
  reveal: {
    title: string
    period: string
    description: string
  }
  info: {
    volume: string
    volatility: string
    correlation: string
    marketContext: string
    sector: string
  }
  /** Статические данные «как действовали другие» для второй точки. */
  crowd: { label: string; percent: number }[]
}

/* ------------------------------------------------------------------ */
/* Market Maker                                                        */
/* ------------------------------------------------------------------ */

/** Режим потока заявок. Игрок узнаёт его только в replay. */
export type FlowRegime = 'noise' | 'informed' | 'momentum'

/** Режим движения скрытой справедливой цены. */
export type FairValueRegime = 'calm' | 'drift-up' | 'drift-down' | 'volatile'

export interface MMFlowPhase {
  regime: FlowRegime
  /** Границы фазы в секундах от начала раунда. */
  from: number
  to: number
  /** Множитель частоты заявок, 1 — базовая интенсивность режима. */
  intensity?: number
}

export interface MMFairValuePhase {
  regime: FairValueRegime
  from: number
  to: number
  /** Множитель дрейфа и шума режима, 1 — базовая сила. */
  strength?: number
}

export interface MarketMakerScenario extends BaseScenario {
  hedgeCostMultiplier?: number
  softInventoryLimit?: number
  inventoryCarryCost?: number
  id: string
  seed: number
  /** Короткое описание для debug-панели. */
  title: string
  initialFairValue: number
  durationSeconds: number
  flowPhases: MMFlowPhase[]
  fairValuePhases: MMFairValuePhase[]
}

export interface MMTrade {
  tick: number
  /** Сторона контрагента. Маркет-мейкер всегда на противоположной. */
  botSide: 'buy' | 'sell'
  size: number
  price: number
  marketPriceAtTrade: number
  fairValueAtTrade: number
  inventoryAfter: number
  /** Сделка увеличила абсолютный размер inventory. */
  increasedRisk: boolean
  /** Движение fair value через несколько тиков против рынка в момент сделки, в деньгах. */
  markout: number
  regime: FlowRegime
}

export interface MMTickPoint {
  tick: number
  fairValue: number
  marketPrice: number
  bid: number
  ask: number
  inventory: number
  pnl: number
}

export interface MMPhaseStats {
  regime: FlowRegime
  from: number
  to: number
  fills: number
  averageSpread: number
  adverseSelectionLoss: number
  pnlChange: number
  /** Средний модуль отклонения середины котировки от fair value. */
  averageQuoteLag: number
}

export interface MarketMakerResult {
  scenarioId: string
  seed: number
  pnl: number
  spreadPnl: number
  inventoryPnl: number
  hedgeCosts: number
  maxInventory: number
  tradeCount: number
  averageSpread: number
  adverseSelectionLoss: number
  hedgeCount: number
  hedgedUnits: number
  finalInventory: number
  spreadChanges: number
  quoteMoves: number
  secondsAboveSoftLimit: number
  /** Средняя задержка реакции на крупный inventory, секунды; null — поводов не было. */
  inventoryResponseSeconds: number | null
  /** Средний спред в первой и второй половине раунда. */
  spreadFirstHalf: number
  spreadSecondHalf: number
  /** Средний спред в фазах шумового и направленного потока. */
  spreadNoise: number
  spreadDirectional: number
  phases: MMPhaseStats[]
  /** Полный путь раунда для replay. В старых сохранениях отсутствует. */
  timeline?: MMTickPoint[]
  trades?: MMTrade[]
  score: number
}

/* ------------------------------------------------------------------ */
/* Market Shock (id испытания — 'black-swan')                          */
/* ------------------------------------------------------------------ */

export type ShockAction = 'close' | 'hedge' | 'hold' | 'increase'

export type ShockPattern =
  | 'trend-collapse'
  | 'v-reversal'
  | 'false-breakdown'
  | 'liquidity-crisis'
  | 'second-leg'

/** Структура рынка до шока. */
export type ShockPreStructure = 'uptrend' | 'range' | 'downtrend' | 'recovery' | 'compression'

export type PositionDirection = 'long' | 'short'

export interface MarketShockPhase {
  /** Изменение среднего диапазона свечей относительно истории, %. */
  volatilityChange: number
  liquidityChange: number
  volumeMultiplier: number
  /** Сдвиг цены за фазу, %. */
  priceChange: number
  marketDescription: string
  availableActions: ShockAction[]
}

export interface MarketShockContext {
  volatility: string
  liquidity: string
  volumeMultiplier: number
}

/** Смоделированное распределение решений других игроков в фазе, %. */
export type ShockCrowd = Record<ShockAction, number>

export interface MarketShockScenario extends BaseScenario {
  id: string
  seed: number
  pattern: ShockPattern
  preStructure: ShockPreStructure
  assetHiddenName: string
  revealAsset: string
  revealPeriod: string
  revealEvent: string
  revealDescription: string
  /** Сценарий построен генератором, а не по историческим котировкам. */
  synthetic: boolean
  asset: BlindMarketScenario['asset']
  startTime: string
  endTime: string
  baseTimeframe: TimeframeId
  internalTags: string[]
  sourceUrl: string
  primaryTimeframe: TimeframeId
  contextTimeframe: TimeframeId
  availableTimeframes?: TimeframeId[]
  /** Базовая серия в разрешении основного таймфрейма. */
  candles: OhlcvCandle[]
  /** Сколько свечей видно на этапе контекста. */
  initialVisibleIndex: number
  /** Сколько свечей видно в момент решения каждой фазы. */
  phaseCheckpoints: [number, number, number]
  initialPosition: {
    direction: PositionDirection
    exposure: number
    entryPrice: number
  }
  context: MarketShockContext
  phases: [MarketShockPhase, MarketShockPhase, MarketShockPhase]
  crowd: ShockCrowd[]
}

export interface ShockDecision {
  /** 1, 2 или 3. */
  phase: number
  action: ShockAction
  /** Экспозиция со знаком: long > 0, short < 0. */
  positionBefore: number
  positionAfter: number
  price: number
  /** PnL в % капитала в момент решения. */
  pnlBefore: number
  /** PnL в % капитала к следующей контрольной точке. */
  pnlAfter?: number
  decisionTimeMs: number
  timestamp: number
  timedOut: boolean
}

export interface UserPriceLevel {
  id: string
  price: number
}

export interface MarketShockResult {
  scenarioId: string
  seed: number
  pattern: ShockPattern
  pnl: number
  pnlPercent: number
  /** Максимальная просадка капитала от пика, %. */
  maxDrawdown: number
  maxExposure: number
  minExposure: number
  positionChanges: number
  averageDecisionMs: number
  decisions: ShockDecision[]
  levels: UserPriceLevel[]
  /** Индексы свечей для точек replay. */
  maxDrawdownIndex: number
  maxPnlIndex: number
  maxPnlPercent: number
  score: number
}

/* ------------------------------------------------------------------ */
/* Cross Arbitrage                                                     */
/* ------------------------------------------------------------------ */

export interface ArbitrageVenueQuote {
  venueId: string
  venueName: string
  /** По этой цене площадка купит у игрока. */
  bid: number
  /** По этой цене игрок может купить. */
  ask: number
  /** Доля от цены сделки: 0.001 = 0,10%. */
  feeRate: number
  /** Объём на первом уровне, отдельно для каждой стороны. */
  bidLiquidity: number
  askLiquidity: number
  thirdBid?: number
  thirdAsk?: number
  thirdBidLiquidity?: number
  thirdAskLiquidity?: number
  secondBid?: number
  secondAsk?: number
  secondBidLiquidity?: number
  secondAskLiquidity?: number
}

/**
 * A — очевидный арбитраж, B — ложный (gross > 0, net ≤ 0),
 * C — нет возможности, D — несколько вариантов, один заметно лучше.
 */
export type CrossArbitrageKind = 'obvious' | 'false' | 'none' | 'small' | 'multiple'

export interface CrossArbitrageScenario extends BaseScenario {
  quoteStepMs?: number
  id: string
  asset: string
  kind: CrossArbitrageKind
  seed: number
  quotes: ArbitrageVenueQuote[]
  durationSeconds: number
  /** Лучшая пара площадок постепенно сходится по seed. */
  dynamic?: boolean
  revealText?: string
}

/** Один полный challenge — пять рынков подряд. */
export interface CrossArbitrageSession extends BaseScenario {
  scenarios?: CrossArbitrageScenario[]
  id: string
  seed: number
  scenarioIds: string[]
}

export interface ArbitrageRoundResult {
  scenarioId: string
  buyVenue?: string
  sellVenue?: string
  choseNoTrade: boolean
  timedOut: boolean
  /** Доли единицы, по котировкам в момент решения. */
  grossReturn: number
  /** Чистый edge на единицу только после комиссий. */
  netBeforeLiquidity: number
  /** Чистый edge на единицу после комиссий и ликвидности. */
  netReturn: number
  /** Расшифровка исполнения; optional для ранее сохранённых результатов. */
  avgBuyPrice?: number
  avgSellPrice?: number
  feeReturn?: number
  slippageReturn?: number
  sizingScore?: number
  /** Вклад рынка в капитал: netReturn × positionSize. */
  capitalReturn: number
  /** Лучший достижимый вклад в капитал по исходным котировкам. */
  optimalNetReturn: number
  optimalBuyVenue?: string
  optimalSellVenue?: string
  optimalPositionSize?: number
  /** 0 при «Сделки нет», иначе 0.10 … 1. */
  positionSize: number
  decisionTimeMs: number
  /** Шаг котировок, по которому исполнилась сделка; 0 — исходные. */
  quoteStep: number
  /** Часть объёма исполнилась хуже из-за ограниченной ликвидности. */
  liquidityHit: boolean
  /** Сколько миллисекунд оставалось до схождения котировок; только для dynamic. */
  msBeforeClose?: number
  profitable: boolean
  optimalChoice: boolean
  roundScore: number
}

export interface CrossArbitrageResult {
  scenarioId: string
  seed: number
  rounds: ArbitrageRoundResult[]
  /** Суммарный результат в % капитала. */
  totalReturnPercent: number
  opportunities: number
  found: number
  falseTrades: number
  missed: number
  correctPasses: number
  tradeCount: number
  averageSizeUnits?: number
  sizeWorsenedCount?: number
  averageDecisionMs: number
  /** Лучший чистый edge на единицу среди прибыльных сделок, %. */
  bestEdgePercent: number
  score: number
}

/* ------------------------------------------------------------------ */
/* Достижения                                                          */
/* ------------------------------------------------------------------ */

export interface Achievement {
  id: string
  title: string
  description: string
}
