import { getBlackSwanScenario } from '@/data/blackSwanScenarios'
import { getBlindScenario } from '@/data/blindMarketScenarios'
import { getMarketMakerScenario } from '@/data/marketMakerScenarios'
import { computeBlackSwan } from '@/games/black-swan/scoring'
import { computeBlindMarket } from '@/games/blind-market/scoring'
import { MarketMakerEngine } from '@/games/market-maker/engine'
import { useGameStore } from '@/store/gameStore'
import type {
  BlackSwanDecision,
  BlindDecision,
  BlindInfoKey,
} from '@/types/game'

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

  const swan = buildBlackSwanDemo()
  store.saveResult({ challengeType: 'black-swan', result: swan })
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
  const scenario = getMarketMakerScenario('mm_informed')
  const engine = new MarketMakerEngine(scenario)

  for (let tick = 0; tick < engine.totalTicks; tick += 1) {
    engine.tick()
    const state = engine.snapshot()
    if (Math.abs(state.inventory) >= 8) engine.hedge()
    if (tick > 20 && state.spread < 1.2) engine.widenSpread()
  }

  return engine.buildResult()
}

function buildBlackSwanDemo() {
  const scenario = getBlackSwanScenario('swan_energy')
  const decisions: BlackSwanDecision[] = [
    {
      phaseIndex: 0,
      action: 'hold',
      exposureBefore: scenario.initialPosition,
      exposureAfter: scenario.initialPosition,
      timeMs: 6400,
      timedOut: false,
    },
    {
      phaseIndex: 1,
      action: 'hedge',
      exposureBefore: scenario.initialPosition,
      exposureAfter: scenario.initialPosition * 0.35,
      timeMs: 4800,
      timedOut: false,
    },
    {
      phaseIndex: 2,
      action: 'increase',
      exposureBefore: scenario.initialPosition * 0.35,
      exposureAfter: Math.min(1, scenario.initialPosition * 0.35 * 1.4),
      timeMs: 3900,
      timedOut: false,
    },
  ]

  const computation = computeBlackSwan(scenario, decisions)

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    pnl: computation.pnl,
    pnlPercent: computation.pnlPercent,
    maxDrawdown: computation.maxDrawdown,
    maxExposure: computation.maxExposure,
    positionChanges: computation.positionChanges,
    decisions,
    timeToDecision: decisions.map((decision) => decision.timeMs),
    score: computation.score,
  }
}
