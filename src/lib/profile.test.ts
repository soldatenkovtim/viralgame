import { describe, expect, it } from 'vitest'
import { blackSwanScenarios } from '@/data/blackSwanScenarios'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { computeBlackSwan } from '@/games/black-swan/scoring'
import { computeBlindMarket } from '@/games/blind-market/scoring'
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
  BlackSwanResult,
  BlindMarketResult,
  MarketMakerResult,
} from '@/types/game'

const blindScenario = blindMarketScenarios[0]
const swanScenario = blackSwanScenarios[0]

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
    scenarioId: 'mm_informed',
    seed: 918264,
    botType: 'informed',
    pnl: 340,
    maxInventory: 8,
    tradeCount: 18,
    averageSpread: 0.9,
    adverseSelectionLoss: 120,
    grossEdge: 460,
    hedgeCount: 2,
    finalInventory: -1,
    spreadChanges: 7,
    quoteMoves: 9,
    spreadFirstHalf: 0.7,
    spreadSecondHalf: 1.1,
    score: 62,
  }
}

function makeSwanResult(): BlackSwanResult {
  const decisions = [
    {
      phaseIndex: 0,
      action: 'hedge' as const,
      exposureBefore: 0.6,
      exposureAfter: 0.21,
      timeMs: 5200,
      timedOut: false,
    },
    {
      phaseIndex: 1,
      action: 'hold' as const,
      exposureBefore: 0.21,
      exposureAfter: 0.21,
      timeMs: 3100,
      timedOut: false,
    },
    {
      phaseIndex: 2,
      action: 'increase' as const,
      exposureBefore: 0.21,
      exposureAfter: 0.29,
      timeMs: 6400,
      timedOut: false,
    },
  ]
  const computation = computeBlackSwan(swanScenario, decisions)

  return {
    scenarioId: swanScenario.id,
    seed: swanScenario.seed,
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
  it('собирает все пять характеристик в диапазоне 20–95', () => {
    const profile = buildTradingProfile({
      blindMarket: makeBlindResult(),
      marketMaker: makeMakerResult(),
      blackSwan: makeSwanResult(),
    })

    for (const trait of traitOrder) {
      expect(profile[trait]).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(profile[trait]).toBeLessThanOrEqual(TRAIT_MAX)
    }
  })

  it('всегда присваивает существующий архетип', () => {
    const profile = buildTradingProfile({
      blindMarket: makeBlindResult(),
      marketMaker: makeMakerResult(),
      blackSwan: makeSwanResult(),
    })

    expect(allArchetypeNames).toContain(profile.archetype)
  })

  it('формирует непустое описание сессии', () => {
    const profile = buildTradingProfile({
      blindMarket: makeBlindResult(),
      marketMaker: makeMakerResult(),
      blackSwan: makeSwanResult(),
    })

    expect(profile.description.length).toBeGreaterThan(40)
    expect(profile.description).not.toMatch(/хорош|плох|не подходит|квалификац/i)
  })

  it('ценообразование зависит только от маркет-мейкинга', () => {
    const withoutMaker = buildTradingProfile({ blindMarket: makeBlindResult() })
    expect(withoutMaker.pricing).toBe(scaleTrait(50))
  })

  it('детерминирован для одних и тех же результатов', () => {
    const input = {
      blindMarket: makeBlindResult(),
      marketMaker: makeMakerResult(),
      blackSwan: makeSwanResult(),
    }

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
    })

    expect(score).toBe(LEADERBOARD_MAX_SCORE)
  })

  it('взвешивает испытания как 35 / 35 / 30', () => {
    const score = computeOverallScore({
      blindMarket: { ...makeBlindResult(), score: 100 },
      marketMaker: { ...makeMakerResult(), score: 0 },
      blackSwan: { ...makeSwanResult(), score: 0 },
    })

    expect(score).toBe(3500)
  })
})

describe('profileCompletion', () => {
  it('соответствует шагам 0 / 33 / 66 / 100', () => {
    expect(profileCompletion(0)).toBe(0)
    expect(profileCompletion(1)).toBe(33)
    expect(profileCompletion(2)).toBe(66)
    expect(profileCompletion(3)).toBe(100)
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
