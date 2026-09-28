import { getBlindScenario } from '@/data/blindMarketScenarios'
import { getCrossArbitrageSession, sessionScenarios } from '@/data/crossArbitrageScenarios'
import { getMarketMakerScenario } from '@/data/marketMakerScenarios'
import { computeBlindMarket } from '@/games/blind-market/scoring'
import { bestTrade } from '@/games/cross-arbitrage/engine'
import { buildCrossArbitrageResult, evaluateRound } from '@/games/cross-arbitrage/scoring'
import { MarketMakerEngine } from '@/games/market-maker/engine'
import { decisionsFromActions } from '@/games/market-shock/engine'
import { getMarketShockScenario } from '@/games/market-shock/scenarios'
import { buildMarketShockResult } from '@/games/market-shock/scoring'
import { useGameStore } from '@/store/gameStore'
import type { BlindDecision, BlindInfoKey } from '@/types/game'

/**
 * Собирает правдоподобную завершённую сессию для debug-режима.
 * Нужно, чтобы сразу открывать финальный профиль без ручного прохождения.
 */
export function seedCompletedSeries(): void {
  const store = useGameStore.getState()
  store.resetProgress()

  const blind = buildBlindDemo()
  store.saveResult({ challengeType: 'blind-market', result: blind })

  const maker = buildMarketMakerDemo()
  store.saveResult({ challengeType: 'market-maker', result: maker })

  const swan = buildMarketShockDemo()
  store.saveResult({ challengeType: 'black-swan', result: swan })

  const arbitrage = buildCrossArbitrageDemo()
  store.saveResult({ challengeType: 'cross-arbitrage', result: arbitrage })
}

/** Находит лучшие маршруты, но один раз попадает в ловушку комиссий. */
function buildCrossArbitrageDemo() {
  const session = getCrossArbitrageSession('arb_session_01')
  const rounds = sessionScenarios(session).map((scenario, index) => {
    const best = bestTrade(scenario.quotes)
    const decisionTimeMs = 4200 + index * 900
    if (scenario.kind === 'false') {
      return evaluateRound(scenario, {
        buyVenue: best.buyVenue,
        sellVenue: best.sellVenue,
        positionSize: 0.5,
        decisionTimeMs,
        timedOut: false,
      })
    }
    if (best.capitalReturn <= 0) {
      return evaluateRound(scenario, { positionSize: 0, decisionTimeMs, timedOut: false })
    }
    return evaluateRound(scenario, {
      buyVenue: best.buyVenue,
      sellVenue: best.sellVenue,
      positionSize: 0.75,
      decisionTimeMs,
      timedOut: false,
    })
  })
  return buildCrossArbitrageResult(session, rounds)
}

function buildBlindDemo() {
  const scenario = getBlindScenario('blind_01')
  const selectedInformation: BlindInfoKey[] = ['volume', 'marketContext']
  const prices = scenario.checkpoints.map(
    (checkpoint) => scenario.candles[checkpoint - 1].close,
  )

  const decisions: BlindDecision[] = [
    {
      checkpointIndex: 0,
      direction: 'long',
      exposure: 0.5,
      confidence: 72,
      priceAtDecision: prices[0],
      timeMs: 4200,
    },
    {
      checkpointIndex: 1,
      direction: 'long',
      action: 'hold',
      exposure: 0.5,
      confidence: 68,
      priceAtDecision: prices[1],
      timeMs: 3100,
    },
    {
      checkpointIndex: 2,
      direction: 'long',
      action: 'increase',
      exposure: 0.75,
      confidence: 81,
      priceAtDecision: prices[2],
      timeMs: 2600,
    },
  ]

  const computation = computeBlindMarket(scenario, decisions)

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    pnl: computation.pnl,
    pnlPercent: computation.pnlPercent,
    maxDrawdown: computation.maxDrawdown,
    selectedInformation,
    decisions,
    averageConfidence: computation.averageConfidence,
    directionChanges: computation.directionChanges,
    timeToDecision: decisions.map((decision) => decision.timeMs),
    segmentReturns: computation.segmentReturns,
    score: computation.score,
  }
}

function buildMarketMakerDemo() {
  const scenario = getMarketMakerScenario('mm_informed_rally')
  const engine = new MarketMakerEngine(scenario)

  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    const state = engine.snapshot()
    const mid = (state.bid + state.ask) / 2
    const target = state.marketPrice - state.inventory * 0.03
    if (target - mid > 0.06) engine.moveQuotes(1)
    if (mid - target > 0.06) engine.moveQuotes(-1)
    if (Math.abs(state.inventory) >= 15) engine.hedge()
  }

  return engine.buildResult()
}

/** Держит первый сигнал, хеджирует на шоке и немного добирает на развитии. */
function buildMarketShockDemo() {
  const scenario = getMarketShockScenario('shock_trend_collapse')
  const decisions = decisionsFromActions(scenario, ['hold', 'hedge', 'increase'], 5200)
  const entry = scenario.candles[scenario.initialVisibleIndex - 1].close
  return buildMarketShockResult(scenario, decisions, [
    { id: 'demo-level-1', price: Math.round(entry * 0.985 * 100) / 100 },
  ])
}
