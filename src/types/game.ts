export type ChallengeType = 'blind-market' | 'market-maker' | 'black-swan'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface ChallengeResult {
  challengeType: ChallengeType
  scenarioId: string
  score: number
  completedAt: string
}

export interface TradingProfile {
  marketSense: number
  riskControl: number
  pricing: number
  adaptability: number
  discipline: number
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
  /** Миллисекунды на обдумывание. */
  timeMs: number
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
}

export interface BlindMarketScenario {
  id: string
  title: string
  seed: number
  candles: Candle[]
  /** Индексы свечей, на которых рынок останавливается для решения. */
  checkpoints: number[]
  reveal: {
    title: string
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

export type BotType = 'noise' | 'informed' | 'momentum'

export interface MarketMakerScenario {
  id: string
  seed: number
  botType: BotType
  volatility: number
  initialFairValue: number
  durationSeconds: number
}

export interface MMTrade {
  tick: number
  /** Сторона бота. Пользователь всегда на противоположной. */
  botSide: 'buy' | 'sell'
  size: number
  price: number
  fairValueAtTrade: number
  /** Markout относительно fair value через несколько тиков. */
  markout: number
}

export interface MarketMakerResult {
  scenarioId: string
  seed: number
  botType: BotType
  pnl: number
  maxInventory: number
  tradeCount: number
  averageSpread: number
  adverseSelectionLoss: number
  /** Сумма заработанного спреда до учёта adverse selection. */
  grossEdge: number
  hedgeCount: number
  finalInventory: number
  spreadChanges: number
  quoteMoves: number
  /** Средний спред в первой и второй половине раунда — для нарратива. */
  spreadFirstHalf: number
  spreadSecondHalf: number
  score: number
}

/* ------------------------------------------------------------------ */
/* Black Swan                                                          */
/* ------------------------------------------------------------------ */

export type BlackSwanAction = 'close' | 'hedge' | 'hold' | 'increase'

export interface BlackSwanPhaseConfig {
  priceChange: number
  volatilityChange: number
  liquidityChange: number
  description: string
}

export interface BlackSwanScenario {
  id: string
  titleAfterReveal: string
  revealDescription: string
  seed: number
  initialPosition: number
  initialPnl: number
  contextVolatility: string
  phases: BlackSwanPhaseConfig[]
}

export interface BlackSwanDecision {
  phaseIndex: number
  action: BlackSwanAction
  exposureBefore: number
  exposureAfter: number
  timeMs: number
  timedOut: boolean
}

export interface BlackSwanResult {
  scenarioId: string
  seed: number
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  maxExposure: number
  positionChanges: number
  decisions: BlackSwanDecision[]
  timeToDecision: number[]
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
