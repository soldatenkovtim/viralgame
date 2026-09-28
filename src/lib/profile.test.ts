import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { crossArbitrageSessions, sessionScenarios } from '@/data/crossArbitrageScenarios'
import { computeBlindMarket } from '@/games/blind-market/scoring'
import { bestTrade } from '@/games/cross-arbitrage/engine'
import { buildCrossArbitrageResult, evaluateRound } from '@/games/cross-arbitrage/scoring'
import { decisionsFromActions } from '@/games/market-shock/engine'
import { marketShockScenarios } from '@/games/market-shock/scenarios'
import { buildMarketShockResult } from '@/games/market-shock/scoring'
import { LEADERBOARD_MAX_SCORE, TRAIT_MAX, TRAIT_MIN } from '@/lib/constants'
import {
  allArchetypeNames,
  buildTradingProfile,
  computeOverallScore,
  profileCompletion,
  scaleTrait,
  traitOrder,
} from '@/lib/profile'
import { decodeSharePayload, encodeSharePayload, type SharePayload } from '@/lib/sharing'
import type {
  BlindMarketResult,
  CrossArbitrageResult,
  MarketMakerResult,
  MarketShockResult,
} from '@/types/game'

const blindScenario = blindMarketScenarios[0]
const swanScenario = marketShockScenarios[0]

function makeBlindResult(): BlindMarketResult {
  const decisions = [0.5, 0.75, 0.5].map((exposure, checkpointIndex) => ({
    checkpointIndex,
    direction: 'long' as const,
    exposure,
    confidence: 78,
    priceAtDecision: 100,
    timeMs: 4200,
  }))
  const computation = computeBlindMarket(blindScenario, decisions)

  return {
    scenarioId: blindScenario.id,
    seed: blindScenario.seed,
    pnl: computation.pnl,
    pnlPercent: computation.pnlPercent,
    maxDrawdown: computation.maxDrawdown,
    selectedInformation: ['volume', 'volatility'],
    decisions,
    averageConfidence: computation.averageConfidence,
    directionChanges: computation.directionChanges,
    timeToDecision: [4200, 4200, 4200],
    segmentReturns: computation.segmentReturns,
    score: computation.score,
  }
}

function makeMakerResult(): MarketMakerResult {
  return {
    scenarioId: 'mm_late_informed',
    seed: 918264,
    pnl: 1340,
    spreadPnl: 2460,
    inventoryPnl: -620,
    hedgeCosts: 500,
    maxInventory: 12,
    tradeCount: 28,
    averageSpread: 0.9,
    adverseSelectionLoss: 420,
    hedgeCount: 2,
    hedgedUnits: 18,
    finalInventory: -1,
    spreadChanges: 7,
    quoteMoves: 19,
    secondsAboveSoftLimit: 0,
    inventoryResponseSeconds: 2.5,
    spreadFirstHalf: 0.7,
    spreadSecondHalf: 1.1,
    spreadNoise: 0.7,
    spreadDirectional: 1.1,
    phases: [
      { regime: 'noise', from: 0, to: 24, fills: 10, averageSpread: 0.7, adverseSelectionLoss: 0, pnlChange: 700, averageQuoteLag: 0.1 },
      { regime: 'momentum', from: 24, to: 40, fills: 9, averageSpread: 1, adverseSelectionLoss: 120, pnlChange: 240, averageQuoteLag: 0.3 },
      { regime: 'informed', from: 40, to: 60, fills: 9, averageSpread: 1.2, adverseSelectionLoss: 300, pnlChange: 400, averageQuoteLag: 0.35 },
    ],
    score: 62,
  }
}

function makeSwanResult(): MarketShockResult {
  const decisions = decisionsFromActions(swanScenario, ['hedge', 'hold', 'increase'], 5000)
  return buildMarketShockResult(swanScenario, decisions, [])
}

function makeArbitrageResult(): CrossArbitrageResult {
  const session = crossArbitrageSessions[0]
  const rounds = sessionScenarios(session).map((scenario) => {
    const best = bestTrade(scenario.quotes)
    return best.capitalReturn > 0
      ? evaluateRound(scenario, {
          buyVenue: best.buyVenue,
          sellVenue: best.sellVenue,
          positionSize: 0.75,
          decisionTimeMs: 5200,
          timedOut: false,
        })
      : evaluateRound(scenario, { positionSize: 0, decisionTimeMs: 6100, timedOut: false })
  })
  return buildCrossArbitrageResult(session, rounds)
}

const fullInput = () => ({
  blindMarket: makeBlindResult(),
  marketMaker: makeMakerResult(),
  blackSwan: makeSwanResult(),
  crossArbitrage: makeArbitrageResult(),
})

describe('scaleTrait', () => {
  it('никогда не показывает крайние 0 и 100', () => {
    expect(scaleTrait(0)).toBe(TRAIT_MIN)
    expect(scaleTrait(100)).toBe(TRAIT_MAX)
    expect(scaleTrait(-50)).toBe(TRAIT_MIN)
    expect(scaleTrait(500)).toBe(TRAIT_MAX)
  })

  it('монотонна', () => {
    expect(scaleTrait(80)).toBeGreaterThan(scaleTrait(40))
  })
})

describe('buildTradingProfile', () => {
  it('собирает все шесть характеристик в диапазоне 20–95', () => {
    const profile = buildTradingProfile(fullInput())

    for (const trait of traitOrder) {
      expect(profile[trait]).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(profile[trait]).toBeLessThanOrEqual(TRAIT_MAX)
    }
  })

  it('всегда присваивает существующий архетип', () => {
    const profile = buildTradingProfile(fullInput())

    expect(allArchetypeNames).toContain(profile.archetype)
  })

  it('формирует непустое описание сессии', () => {
    const profile = buildTradingProfile(fullInput())

    expect(profile.description.length).toBeGreaterThan(40)
    expect(profile.description).not.toMatch(/хорош|плох|не подходит|квалификац/i)
  })

  it('ценообразование зависит только от маркет-мейкинга', () => {
    const withoutMaker = buildTradingProfile({ blindMarket: makeBlindResult() })
    expect(withoutMaker.pricing).toBe(scaleTrait(50))
  })

  it('поиск возможностей зависит только от кросс-арбитража', () => {
    const withoutArbitrage = buildTradingProfile({
      blindMarket: makeBlindResult(),
      marketMaker: makeMakerResult(),
      blackSwan: makeSwanResult(),
    })
    expect(withoutArbitrage.opportunity).toBe(scaleTrait(50))

    const full = buildTradingProfile(fullInput())
    expect(full.opportunity).toBeGreaterThan(scaleTrait(50))
    expect(full.description).toMatch(/кросс-арбитраж/)
  })

  it('детерминирован для одних и тех же результатов', () => {
    const input = fullInput()

    expect(buildTradingProfile(input)).toEqual(buildTradingProfile(input))
  })
})

describe('computeOverallScore', () => {
  it('ноль без пройденных испытаний', () => {
    expect(computeOverallScore({})).toBe(0)
  })

  it('не превышает максимум рейтинга', () => {
    const score = computeOverallScore({
      blindMarket: { ...makeBlindResult(), score: 100 },
      marketMaker: { ...makeMakerResult(), score: 100 },
      blackSwan: { ...makeSwanResult(), score: 100 },
      crossArbitrage: { ...makeArbitrageResult(), score: 100 },
    })

    expect(score).toBe(LEADERBOARD_MAX_SCORE)
  })

  it('взвешивает испытания поровну: 25 / 25 / 25 / 25', () => {
    const score = computeOverallScore({
      blindMarket: { ...makeBlindResult(), score: 100 },
      marketMaker: { ...makeMakerResult(), score: 0 },
      blackSwan: { ...makeSwanResult(), score: 0 },
      crossArbitrage: { ...makeArbitrageResult(), score: 0 },
    })

    expect(score).toBe(2500)
  })
})

describe('profileCompletion', () => {
  it('соответствует шагам 0 / 25 / 50 / 75 / 100', () => {
    expect(profileCompletion(0)).toBe(0)
    expect(profileCompletion(1)).toBe(25)
    expect(profileCompletion(2)).toBe(50)
    expect(profileCompletion(3)).toBe(75)
    expect(profileCompletion(4)).toBe(100)
  })
})

describe('share payload', () => {
  it('переживает кодирование и декодирование с кириллицей', () => {
    const payload: SharePayload = {
      t: 'blind-market',
      s: 'blind_01',
      d: 730114,
      r: 4.82,
      a: ['Лонг 50%', 'Держал', 'Увеличил'],
      e: [0.5, 0.5, 0.75],
      n: 'дельта',
    }

    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload)
  })

  it('переносит метрики кросс-арбитража', () => {
    const payload: SharePayload = {
      t: 'cross-arbitrage',
      s: 'arb_session_01',
      d: 510301,
      r: 1.42,
      a: ['Alpha → Beta · 100%', 'Сделки нет'],
      m: [3, 1, 6400, 3, 1],
      p: [0.343, 0],
    }

    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload)
  })

  it('не содержит символов, ломающих URL', () => {
    const encoded = encodeSharePayload({
      t: 'black-swan',
      s: 'swan_energy',
      d: 220401,
      r: -6.4,
      a: ['Хеджировал', 'Держал', 'Закрыл'],
    })

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('возвращает null на повреждённых данных', () => {
    expect(decodeSharePayload('не-base64!!')).toBeNull()
    expect(decodeSharePayload(btoa('{"t":"blind-market"}'))).toBeNull()
  })
})
