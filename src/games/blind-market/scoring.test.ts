import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { CAPITAL } from '@/lib/constants'
import type { BlindDecision, BlindMarketScenario } from '@/types/game'
import {
  applyAction,
  blindScore,
  blindTraits,
  buildTradeTimeline,
  computeBlindMarket,
  computeHitRate,
  computeMaxDrawdown,
  computeRunningPnl,
  getFollowUpActions,
  simulateBlind,
} from './scoring'

const scenario: BlindMarketScenario = blindMarketScenarios[0]

function decision(exposure: number, checkpointIndex: number): BlindDecision {
  return {
    checkpointIndex,
    direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat',
    exposure,
    confidence: 75,
    priceAtDecision: 100,
    timeMs: 3000,
  }
}

describe('applyAction', () => {
  it('увеличивает позицию шагом 25% в сторону текущего направления', () => {
    expect(applyAction(0.5, 'increase')).toBe(0.75)
    expect(applyAction(-0.5, 'increase')).toBe(-0.75)
  })

  it('не выпускает экспозицию за пределы 100%', () => {
    expect(applyAction(1, 'increase')).toBe(1)
    expect(applyAction(-1, 'increase')).toBe(-1)
  })

  it('сокращает позицию вдвое и закрывает полностью', () => {
    expect(applyAction(0.5, 'reduce')).toBe(0.25)
    expect(applyAction(0.5, 'close')).toBe(0)
  })

  it('переворот меняет знак, сохраняя размер', () => {
    expect(applyAction(0.75, 'flip')).toBe(-0.75)
    expect(applyAction(-0.25, 'flip')).toBe(0.25)
  })

  it('держать не меняет экспозицию', () => {
    expect(applyAction(0.5, 'hold')).toBe(0.5)
  })
})

describe('getFollowUpActions', () => {
  it('в позиции предлагает управление позицией', () => {
    expect(getFollowUpActions(0.5)).toEqual(['increase', 'hold', 'reduce', 'close', 'flip'])
  })

  it('вне рынка предлагает вход, а не управление несуществующей позицией', () => {
    expect(getFollowUpActions(0)).toEqual(['enter-long', 'enter-short', 'stay-flat'])
  })
})

describe('computeMaxDrawdown', () => {
  it('возвращает ноль на растущей кривой', () => {
    expect(computeMaxDrawdown([100, 110, 120])).toBe(0)
  })

  it('считает просадку от локального пика', () => {
    expect(computeMaxDrawdown([100, 120, 90])).toBeCloseTo(25, 5)
  })
})

describe('computeBlindMarket', () => {
  it('вне рынка даёт нулевой PnL и нулевую просадку', () => {
    const result = computeBlindMarket(scenario, [
      decision(0, 0),
      decision(0, 1),
      decision(0, 2),
    ])

    expect(result.pnl).toBe(0)
    expect(result.pnlPercent).toBe(0)
    expect(result.maxDrawdown).toBe(0)
  })

  it('шорт даёт результат, обратный лонгу того же размера', () => {
    const long = computeBlindMarket(scenario, [
      decision(0.5, 0),
      decision(0.5, 1),
      decision(0.5, 2),
    ])
    const short = computeBlindMarket(scenario, [
      decision(-0.5, 0),
      decision(-0.5, 1),
      decision(-0.5, 2),
    ])

    expect(short.pnl).toBeCloseTo(-long.pnl, 6)
  })

  it('удвоение размера удваивает результат', () => {
    const half = computeBlindMarket(scenario, [
      decision(0.5, 0),
      decision(0.5, 1),
      decision(0.5, 2),
    ])
    const full = computeBlindMarket(scenario, [
      decision(1, 0),
      decision(1, 1),
      decision(1, 2),
    ])

    expect(full.pnl).toBeCloseTo(half.pnl * 2, 6)
  })

  it('считает доходность каждого отрезка между точками решений', () => {
    const result = computeBlindMarket(scenario, [
      decision(1, 0),
      decision(1, 1),
      decision(1, 2),
    ])

    expect(result.segmentReturns).toHaveLength(3)

    const boundaries = [...scenario.checkpoints, scenario.candles.length]
    const expectedFirst =
      ((scenario.candles[boundaries[1] - 1].close -
        scenario.candles[boundaries[0] - 1].close) /
        scenario.candles[boundaries[0] - 1].close) *
      100

    expect(result.segmentReturns[0]).toBeCloseTo(expectedFirst, 6)
  })

  it('считает смену направления позиции', () => {
    const result = computeBlindMarket(scenario, [
      decision(0.5, 0),
      decision(-0.5, 1),
      decision(0.5, 2),
    ])

    expect(result.directionChanges).toBe(2)
  })

  it('усредняет уверенность по всем решениям', () => {
    const decisions = [decision(0.5, 0), decision(0.5, 1), decision(0.5, 2)]
    decisions[0].confidence = 60
    decisions[1].confidence = 80
    decisions[2].confidence = 100

    expect(computeBlindMarket(scenario, decisions).averageConfidence).toBeCloseTo(80, 6)
  })

  it('pnlPercent соответствует pnl относительно капитала', () => {
    const result = computeBlindMarket(scenario, [
      decision(0.75, 0),
      decision(0.5, 1),
      decision(0.25, 2),
    ])

    expect(result.pnlPercent).toBeCloseTo((result.pnl / CAPITAL) * 100, 9)
  })
})

describe('computeRunningPnl', () => {
  it('на последней свече совпадает с итоговым PnL', () => {
    const decisions = [decision(0.75, 0), decision(0.5, 1), decision(1, 2)]
    const final = computeBlindMarket(scenario, decisions)
    const running = computeRunningPnl(scenario, decisions, scenario.candles.length - 1)

    expect(running).toBeCloseTo(final.pnl, 6)
  })

  it('до первой сделки результат нулевой', () => {
    expect(computeRunningPnl(scenario, [], scenario.checkpoints[0])).toBe(0)
  })
})

describe('стоп', () => {
  const entryIndex = scenario.checkpoints[0] - 1
  const entryPrice = scenario.candles[entryIndex].close
  const segmentEnd = scenario.checkpoints[1]
  const segmentLow = Math.min(
    ...scenario.candles.slice(entryIndex + 1, segmentEnd).map((candle) => candle.low),
  )

  it('закрывает позицию на свече, где цена дошла до стопа', () => {
    const stop = (entryPrice + segmentLow) / 2
    const withStop = { ...decision(1, 0), stopPrice: stop }
    const simulation = simulateBlind(scenario, [withStop], segmentEnd - 1)

    expect(simulation.stopHits).toHaveLength(1)
    const hit = simulation.stopHits[0]
    expect(scenario.candles[hit.candleIndex].low).toBeLessThanOrEqual(stop)
    expect(hit.price).toBeLessThanOrEqual(stop)
    expect(simulation.exposure).toBe(0)
  })

  it('стоп за пределами движения не влияет на результат', () => {
    const plain = computeBlindMarket(scenario, [decision(1, 0), decision(1, 1), decision(1, 2)])
    const farStop = [decision(1, 0), decision(1, 1), decision(1, 2)].map((item) => ({
      ...item,
      stopPrice: 0.01,
    }))

    expect(computeBlindMarket(scenario, farStop).pnl).toBeCloseTo(plain.pnl, 6)
  })

  it('после срабатывания стопа PnL на отрезке больше не меняется', () => {
    const stop = (entryPrice + segmentLow) / 2
    const withStop = { ...decision(1, 0), stopPrice: stop }
    const hit = simulateBlind(scenario, [withStop], segmentEnd - 1).stopHits[0]

    const atHit = computeRunningPnl(scenario, [withStop], hit.candleIndex)
    const atEnd = computeRunningPnl(scenario, [withStop], segmentEnd - 1)
    expect(atEnd).toBeCloseTo(atHit, 9)
  })
})

describe('buildTradeTimeline', () => {
  it('пересчитывает среднюю цену входа при увеличении позиции', () => {
    const decisions = [decision(0.5, 0), decision(1, 1)]
    const timeline = buildTradeTimeline(scenario, decisions, scenario.checkpoints[1] - 1)
    const p0 = scenario.candles[scenario.checkpoints[0] - 1].close
    const p1 = scenario.candles[scenario.checkpoints[1] - 1].close

    expect(timeline.events.map((event) => event.kind)).toEqual(['open', 'increase'])
    expect(timeline.entryPrice).toBeCloseTo((p0 + p1) / 2, 9)
  })

  it('добавляет выход на последней свече, если позиция осталась открытой', () => {
    const decisions = [decision(0.5, 0), decision(0.5, 1), decision(-0.5, 2)]
    const timeline = buildTradeTimeline(scenario, decisions, scenario.candles.length - 1, true)

    expect(timeline.events.map((event) => event.kind)).toEqual(['open', 'flip', 'exit'])
  })
})

describe('blindScore', () => {
  it('остаётся в диапазоне 0–100 на экстремальных значениях', () => {
    expect(blindScore(999, 0)).toBeLessThanOrEqual(100)
    expect(blindScore(-999, 99)).toBeGreaterThanOrEqual(0)
  })

  it('при равном PnL меньшая просадка даёт больший score', () => {
    expect(blindScore(5, 1)).toBeGreaterThan(blindScore(5, 9))
  })
})

describe('computeHitRate', () => {
  it('полное совпадение направления даёт единицу', () => {
    const decisions = [decision(0.5, 0), decision(0.5, 1), decision(-0.5, 2)]
    expect(computeHitRate(decisions, [3, 2, -4])).toBe(1)
  })

  it('позиция вне рынка засчитывается на спокойном отрезке', () => {
    expect(computeHitRate([decision(0, 0)], [0.4])).toBe(1)
  })
})

describe('blindTraits', () => {
  it('никогда не выходит за 0–100', () => {
    const decisions = [decision(1, 0), decision(1, 1), decision(1, 2)]
    const computation = computeBlindMarket(scenario, decisions)

    const traits = blindTraits({
      scenarioId: scenario.id,
      seed: scenario.seed,
      pnl: computation.pnl,
      pnlPercent: computation.pnlPercent,
      maxDrawdown: computation.maxDrawdown,
      selectedInformation: ['volume', 'sector'],
      decisions,
      averageConfidence: computation.averageConfidence,
      directionChanges: computation.directionChanges,
      timeToDecision: [1000, 1000, 1000],
      segmentReturns: computation.segmentReturns,
      score: computation.score,
    })

    for (const value of Object.values(traits)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
