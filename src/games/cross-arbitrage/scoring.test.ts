import { describe, expect, it } from 'vitest'
import {
  crossArbitrageScenarios,
  crossArbitrageSessions,
  getCrossArbitrageScenario,
  getCrossArbitrageSession,
  sessionScenarios,
} from '@/data/crossArbitrageScenarios'
import { crossArbitrageAchievement } from '@/lib/achievements'
import type { ArbitrageVenueQuote, CrossArbitrageScenario } from '@/types/game'
import {
  ARB_CONVERGENCE_DELAY_MS,
  ARB_DECISION_SECONDS,
  executionPrice,
  bestTrade,
  buildQuotePath,
  evaluateTrade,
  listRoutes,
  quoteStepAt,
  windowCloseMs,
} from './engine'
import {
  arbitrageObservations,
  arbitrageRoundScore,
  buildArbitrageSharePayload,
  buildCrossArbitrageResult,
  crossArbitrageTraits,
  evaluateRound,
  formatEdge,
  roundFeedback,
  type ArbitrageDecision,
} from './scoring'

const quote = (
  venueId: string,
  bid: number,
  ask: number,
  feeRate: number,
  availableLiquidity = 100,
): ArbitrageVenueQuote => ({
  venueId,
  venueName: venueId,
  bid,
  ask,
  feeRate,
  bidLiquidity: availableLiquidity, askLiquidity: availableLiquidity,
  secondBid: bid * 0.999, secondAsk: ask * 1.001,
  secondBidLiquidity: 100 - availableLiquidity, secondAskLiquidity: 100 - availableLiquidity,
})

const noTrade = (decisionTimeMs = 4000): ArbitrageDecision => ({
  positionSize: 0,
  decisionTimeMs,
  timedOut: false,
})

function bestDecision(scenario: CrossArbitrageScenario, decisionTimeMs = 4000): ArbitrageDecision {
  const best = bestTrade(scenario.quotes)
  return {
    buyVenue: best.buyVenue,
    sellVenue: best.sellVenue,
    positionSize: best.positionSize,
    decisionTimeMs,
    timedOut: false,
  }
}

/** Идеальная игра: лучшая сделка там, где она есть, иначе «Сделки нет». */
function perfectDecision(scenario: CrossArbitrageScenario): ArbitrageDecision {
  return bestTrade(scenario.quotes).capitalReturn > 0 ? bestDecision(scenario, 2500) : noTrade(2500)
}

describe('evaluateTrade', () => {
  it('покупает по ask, продаёт по bid и вычитает обе комиссии', () => {
    // Пример из ТЗ: +0,15% gross, 0,20% комиссий → около −0,05%.
    const quotes = [quote('alpha', 99.7, 100, 0.001), quote('beta', 100.15, 100.4, 0.001)]
    const outcome = evaluateTrade(quotes, 'alpha', 'beta', 1)

    expect(outcome.grossReturn).toBeCloseTo(0.0015, 6)
    const expectedNet = (100.15 - 100.15 * 0.001 - 100 - 100 * 0.001) / 100
    expect(outcome.netReturn).toBeCloseTo(expectedNet, 9)
    expect(outcome.netReturn * 100).toBeCloseTo(-0.05, 2)
  })

  it('умножает результат на размер позиции', () => {
    const quotes = [quote('a', 99.6, 99.8, 0.001), quote('b', 100.5, 100.7, 0.0008)]
    const full = evaluateTrade(quotes, 'a', 'b', 1)
    const half = evaluateTrade(quotes, 'a', 'b', 0.5)

    expect(half.netReturn).toBeCloseTo(full.netReturn, 12)
    expect(half.capitalReturn).toBeCloseTo(full.capitalReturn / 2, 12)
  })

  it('исполняет объём сверх ликвидности хуже, но только эту часть', () => {
    const quotes = [quote('a', 99.6, 99.8, 0.0005, 50), quote('b', 100.5, 100.7, 0.0005)]
    const withinLimit = evaluateTrade(quotes, 'a', 'b', 0.5)
    const overLimit = evaluateTrade(quotes, 'a', 'b', 1)

    expect(withinLimit.liquidityHit).toBe(false)
    expect(overLimit.liquidityHit).toBe(true)
    expect(overLimit.netBeforeLiquidity - overLimit.netReturn).toBeCloseTo(
      0.001 * 0.5 * 1.0005,
      12,
    )
  })
})

describe('сценарии', () => {
  it('содержат минимум 10 рынков всех четырёх типов', () => {
    expect(crossArbitrageScenarios.length).toBeGreaterThanOrEqual(10)
    const kinds = new Set(crossArbitrageScenarios.map((scenario) => scenario.kind))
    expect(kinds).toEqual(new Set(['obvious', 'false', 'none', 'small', 'multiple']))
  })

  it.each(crossArbitrageScenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s соответствует своему типу',
    (_id, scenario) => {
      const routes = listRoutes(scenario.quotes)
      const optimal = bestTrade(scenario.quotes).capitalReturn
      const profitableRoutes = routes
        .filter((route) => route.netBeforeLiquidity > 0)
        .sort((a, b) => b.netBeforeLiquidity - a.netBeforeLiquidity)

      expect(scenario.quotes).toHaveLength(3)
      scenario.quotes.forEach((item) => expect(item.ask).toBeGreaterThan(item.bid))

      switch (scenario.kind) {
        case 'small':
          expect(bestTrade(scenario.quotes).positionSize).toBeLessThan(1)
          expect(Math.max(...routes.map((route) => route.netReturn))).toBeLessThanOrEqual(0)
          expect(optimal).toBeGreaterThan(0)
          break
        case 'obvious':
          expect(optimal).toBeGreaterThan(0)
          break
        case 'false':
          expect(Math.max(...routes.map((route) => route.grossReturn))).toBeGreaterThan(0)
          expect(optimal).toBeLessThanOrEqual(0)
          break
        case 'none':
          expect(Math.max(...routes.map((route) => route.grossReturn))).toBeLessThanOrEqual(0)
          break
        case 'multiple':
          expect(profitableRoutes.length).toBeGreaterThanOrEqual(2)
          expect(profitableRoutes[0].netBeforeLiquidity).toBeGreaterThan(
            profitableRoutes[1].netBeforeLiquidity * 1.5,
          )
          break
      }
    },
  )

  it('каждый набор — 5 рынков, из них минимум 25% без арбитража и хотя бы один ложный', () => {
    for (const session of crossArbitrageSessions) {
      const scenarios = sessionScenarios(session)
      expect(scenarios).toHaveLength(5)
      expect(new Set(session.scenarioIds).size).toBe(5)
      session.scenarioIds.forEach((id) => expect(getCrossArbitrageScenario(id).id).toBe(id))

      const empty = scenarios.filter((scenario) => bestTrade(scenario.quotes).capitalReturn <= 0 || scenario.kind === 'small')
      expect(empty.length / scenarios.length).toBeGreaterThanOrEqual(0.25)
      expect(scenarios.some((scenario) => scenario.kind === 'false')).toBe(true)
      expect(scenarios.some((scenario) => scenario.dynamic)).toBe(true)

      const withLiquidity = scenarios.filter((scenario) =>
        scenario.quotes.some((item) => item.bidLiquidity < 100 || item.askLiquidity < 100),
      )
      expect(withLiquidity.length).toBeGreaterThanOrEqual(1)
      expect(withLiquidity.length).toBeLessThanOrEqual(2)
    }
  })

  it('неизвестный id набора открывает первый набор', () => {
    expect(getCrossArbitrageSession('nope').id).toBe(crossArbitrageSessions[0].id)
  })
})

describe('динамические котировки', () => {
  const dynamic = crossArbitrageScenarios.filter((scenario) => scenario.dynamic)

  it('детерминированы по seed', () => {
    for (const scenario of dynamic) {
      expect(buildQuotePath(scenario)).toEqual(buildQuotePath(scenario))
    }
  })

  it('статичный рынок не двигается', () => {
    const scenario = crossArbitrageScenarios.find((item) => !item.dynamic) as CrossArbitrageScenario
    expect(buildQuotePath(scenario)).toHaveLength(1)
    expect(quoteStepAt(14_000, 1)).toBe(0)
  })

  it('обновляются не чаще раза в 2 секунды и закрывают окно до конца таймера', () => {
    for (const scenario of dynamic) {
      const path = buildQuotePath(scenario)
      expect(quoteStepAt(ARB_CONVERGENCE_DELAY_MS - 1, path.length)).toBe(0)

      const changes = new Set<number>()
      for (let ms = 0; ms <= ARB_DECISION_SECONDS * 1000; ms += 100) {
        changes.add(quoteStepAt(ms, path.length))
      }
      expect(changes.size).toBe(path.length)

      const closeMs = windowCloseMs(scenario, path)
      expect(closeMs).not.toBeNull()
      expect(closeMs as number).toBeLessThan(ARB_DECISION_SECONDS * 1000)

      const initial = bestTrade(scenario.quotes)
      const last = evaluateTrade(path.at(-1) as ArbitrageVenueQuote[], initial.buyVenue, initial.sellVenue, 1)
      expect(last.netBeforeLiquidity).toBeLessThanOrEqual(0)
    }
  })
})

describe('evaluateRound и score рынка', () => {
  const falseScenario = getCrossArbitrageScenario('arb_x_false')
  const obvious = getCrossArbitrageScenario('arb_btc_obvious')
  const liquidity = getCrossArbitrageScenario('arb_x_liquidity')
  const dynamic = getCrossArbitrageScenario('arb_eth_dynamic')

  it('«Сделки нет» без возможности — полный результат', () => {
    const round = evaluateRound(falseScenario, noTrade(2500))
    expect(round.optimalChoice).toBe(true)
    expect(round.roundScore).toBeCloseTo(100, 6)
    expect(roundFeedback(round, falseScenario).title).toBe('Исполнимой возможности не было')
  })

  it('сделка в ложном арбитраже — ноль и объяснение про комиссии', () => {
    const round = evaluateRound(falseScenario, { ...bestDecision(falseScenario), positionSize: 1 })
    expect(round.profitable).toBe(false)
    expect(round.roundScore).toBe(0)
    expect(round.grossReturn).toBeGreaterThan(0)
    expect(roundFeedback(round, falseScenario).title).toBe(
      'Комиссии оказались выше ценового расхождения',
    )
  })

  it('неправильная пара — «Спред был в другой паре»', () => {
    const round = evaluateRound(obvious, {
      buyVenue: 'beta',
      sellVenue: 'alpha',
      positionSize: 1,
      decisionTimeMs: 3000,
      timedOut: false,
    })
    expect(round.grossReturn).toBeLessThan(0)
    expect(roundFeedback(round, obvious).title).toBe('Спред был в другой паре')
  })

  it('лучшая сделка — полный score, пропуск — ноль', () => {
    const best = evaluateRound(obvious, bestDecision(obvious, 2500))
    expect(best.optimalChoice).toBe(true)
    expect(best.roundScore).toBeCloseTo(100, 6)
    expect(roundFeedback(best, obvious).title).toBe('Edge сохранился после комиссий')

    const skipped = evaluateRound(obvious, noTrade())
    expect(skipped.roundScore).toBe(25)
    expect(roundFeedback(skipped, obvious).title).toBe('Возможность пропущена')
  })

  it('слишком крупный размер при тонкой ликвидности снижает результат', () => {
    const best = bestTrade(liquidity.quotes)
    expect(best.positionSize).toBeLessThan(1)

    const oversized = evaluateRound(liquidity, { ...bestDecision(liquidity), positionSize: 1 })
    expect(oversized.liquidityHit).toBe(true)
    expect(oversized.capitalReturn).toBeLessThan(best.capitalReturn)
    expect(oversized.roundScore).toBeLessThan(100)
  })

  it('скорость меняет score не больше чем на 15%', () => {
    const fast = arbitrageRoundScore({
      optimalNetReturn: 0.003,
      capitalReturn: 0.003,
      choseNoTrade: false,
      decisionTimeMs: 500,
      timedOut: false,
    })
    const slow = arbitrageRoundScore({
      optimalNetReturn: 0.003,
      capitalReturn: 0.003,
      choseNoTrade: false,
      decisionTimeMs: 14_900,
      timedOut: false,
    })
    expect(fast).toBeCloseTo(100, 6)
    expect(slow).toBeCloseTo(85, 6)

    const wrongButFast = arbitrageRoundScore({
      optimalNetReturn: 0,
      capitalReturn: -0.001,
      choseNoTrade: false,
      decisionTimeMs: 500,
      timedOut: false,
    })
    expect(wrongButFast).toBe(0)
  })

  it('в динамике ожидание схождения не превращает «Сделки нет» в верный ответ', () => {
    const closeMs = windowCloseMs(dynamic, buildQuotePath(dynamic)) as number
    const late = evaluateRound(dynamic, noTrade(closeMs + 100))
    expect(late.optimalNetReturn).toBeGreaterThan(0)
    expect(late.roundScore).toBe(25)
    expect(roundFeedback(late, dynamic).title).toBe('Окно закрылось раньше решения')

    const lateTrade = evaluateRound(dynamic, { ...bestDecision(dynamic), decisionTimeMs: closeMs + 100 })
    expect(lateTrade.profitable).toBe(false)
    expect(roundFeedback(lateTrade, dynamic).title).toBe('Котировки успели сойтись раньше сделки')

    const early = evaluateRound(dynamic, bestDecision(dynamic, 1500))
    expect(early.profitable).toBe(true)
    expect(early.msBeforeClose).toBe(closeMs - 1500)
  })

  it('таймаут засчитывается как «Сделки нет»', () => {
    const round = evaluateRound(falseScenario, {
      positionSize: 0,
      decisionTimeMs: ARB_DECISION_SECONDS * 1000,
      timedOut: true,
    })
    expect(round.choseNoTrade).toBe(true)
    expect(round.roundScore).toBeGreaterThan(0)
  })
})

describe('buildCrossArbitrageResult', () => {
  const session = crossArbitrageSessions[0]
  const scenarios = sessionScenarios(session)

  it('идеальная игра: все возможности найдены, ложных сделок нет', () => {
    const rounds = scenarios.map((scenario) => evaluateRound(scenario, perfectDecision(scenario)))
    const result = buildCrossArbitrageResult(session, rounds)

    expect(result.found).toBe(result.opportunities)
    expect(result.falseTrades).toBe(0)
    expect(result.missed).toBe(0)
    expect(result.correctPasses).toBe(scenarios.length - result.opportunities)
    expect(result.totalReturnPercent).toBeGreaterThan(0)
    expect(result.bestEdgePercent).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(95)
  })

  it('считает ложные и пропущенные сделки', () => {
    const rounds = scenarios.map((scenario) => {
      if (scenario.kind === 'false') return evaluateRound(scenario, { ...bestDecision(scenario), positionSize: 1 })
      if (scenario.kind === 'multiple') return evaluateRound(scenario, noTrade())
      return evaluateRound(scenario, perfectDecision(scenario))
    })
    const result = buildCrossArbitrageResult(session, rounds)

    expect(result.falseTrades).toBe(scenarios.filter(s => s.kind === 'false').length)
    expect(result.missed).toBe(scenarios.filter(s => s.kind === 'multiple').length)
    expect(result.found).toBe(result.opportunities - result.missed)

    const observations = arbitrageObservations(result)
    expect(observations.length).toBeGreaterThan(0)
    expect(observations.length).toBeLessThanOrEqual(2)
    expect(observations[0]).toMatch(/комиссии полностью съели edge/)
    observations.forEach((text) => expect(text).not.toMatch(/квалификац|хорош|плох/i))
  })

  it('черты профиля в диапазоне 0–100 и дисциплина падает от ложных сделок', () => {
    const perfect = buildCrossArbitrageResult(
      session,
      scenarios.map((scenario) => evaluateRound(scenario, perfectDecision(scenario))),
    )
    const reckless = buildCrossArbitrageResult(
      session,
      scenarios.map((scenario) => {
        const best = bestTrade(scenario.quotes)
        return evaluateRound(scenario, {
          buyVenue: best.buyVenue,
          sellVenue: best.sellVenue,
          positionSize: 1,
          decisionTimeMs: 2500,
          timedOut: false,
        })
      }),
    )

    const good = crossArbitrageTraits(perfect)
    const bad = crossArbitrageTraits(reckless)
    for (const value of [...Object.values(good), ...Object.values(bad)]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
    expect(good.discipline).toBeGreaterThan(bad.discipline)
    expect(good.opportunity).toBeGreaterThan(80)
  })

  it('идеальная игра даёт наблюдение-достижение', () => {
    const result = buildCrossArbitrageResult(
      session,
      scenarios.map((scenario) => evaluateRound(scenario, perfectDecision(scenario))),
    )
    expect(crossArbitrageAchievement(result)).not.toBeNull()
  })

  it('share payload воспроизводит тот же набор рынков', () => {
    const result = buildCrossArbitrageResult(
      session,
      scenarios.map((scenario) => evaluateRound(scenario, perfectDecision(scenario))),
    )
    const payload = buildArbitrageSharePayload(session, result)

    expect(payload.t).toBe('cross-arbitrage')
    expect(getCrossArbitrageSession(payload.s)).toEqual(session)
    expect(payload.d).toBe(session.seed)
    expect(payload.a).toHaveLength(5)
    expect(payload.p).toHaveLength(5)
    expect(payload.m?.[0]).toBe(result.tradeCount)
  })
})

describe('formatEdge', () => {
  it('форматирует знак и ноль', () => {
    expect(formatEdge(0.31)).toBe('+0,31%')
    expect(formatEdge(-0.18)).toBe('−0,18%')
    expect(formatEdge(0)).toBe('0,00%')
    expect(formatEdge(-0.0001)).toBe('0,00%')
  })
})


describe('двухуровневое исполнение', () => {
  const buy = { ...quote('a', 249.1, 249.4, 0.001), askLiquidity: 25, secondAsk: 249.75, secondAskLiquidity: 75 }
  const sell = { ...quote('b', 250.5, 251, 0.0009), bidLiquidity: 10, secondBid: 249.9, secondBidLiquidity: 90 }
  it('считает VWAP обеих ног и комиссии от исполненного объёма', () => {
    const trade = evaluateTrade([buy, sell], 'a', 'b', 0.5)
    expect(trade.avgBuyPrice).toBeCloseTo((25 * 249.4 + 25 * 249.75) / 50, 10)
    expect(trade.avgSellPrice).toBeCloseTo((10 * 250.5 + 40 * 249.9) / 50, 10)
    expect(trade.netReturn).toBeCloseTo((trade.avgSellPrice * 0.9991 - trade.avgBuyPrice * 1.001) / 249.4, 10)
    expect(trade.grossReturn - trade.feeReturn - trade.slippageReturn).toBeCloseTo(trade.netReturn, 10)
  })
  it('использует лучшую котировку на границе и отклоняет нехватку глубины', () => {
    expect(executionPrice(buy, 'buy', 25)).toBe(249.4)
    expect(() => executionPrice(buy, 'buy', 101)).toThrow('Insufficient depth')
    expect(() => evaluateTrade([buy, sell], 'a', 'a', 0.25)).toThrow()
  })
  it('в каждом наборе есть ловушка комиссий и прибыль только на малом размере', () => {
    for (const session of crossArbitrageSessions) {
      const scenarios = sessionScenarios(session)
      expect(scenarios.some((s) => s.kind === 'false')).toBe(true)
      expect(scenarios.some(s => { const best = bestTrade(s.quotes); return best.capitalReturn > 0 && best.positionSize < 1 })).toBe(true)
    }
  })
  it('не наказывает размером прибыльный маршрут с полной глубиной', () => {
    const source = getCrossArbitrageScenario('arb_x_liquidity')
    const small = evaluateRound(source, bestDecision(source, 2500))
    const large = evaluateRound(source, { ...bestDecision(source, 2500), positionSize: 1 })
    expect(small.sizingScore).toBe(100)
    expect(large.netReturn).toBeLessThan(0)
    expect(large.sizingScore).toBe(0)
    const result = buildCrossArbitrageResult(crossArbitrageSessions[0], [small, large])
    expect(result.averageSizeUnits).toBe(62.5)
    expect(result.sizeWorsenedCount).toBe(1)
  })
})


it('score учитывает четыре независимые компоненты с весами 40/25/20/15', () => {
  const score = arbitrageRoundScore({ optimalNetReturn: 0.004, capitalReturn: 0.002,
    choseNoTrade: false, decisionTimeMs: 7500, timedOut: false, sizingScore: 80 })
  expect(score).toBeCloseTo(50 * 0.4 + 100 * 0.25 + 80 * 0.2 + 50 * 0.15, 10)
})


it('глубина меняет лучший маршрут относительно минимального Ask', () => {
  const source = getCrossArbitrageScenario('arb_x_multiple_liq')
  expect(source.quotes.reduce((a, b) => a.ask < b.ask ? a : b).venueId).toBe('alpha')
  expect(bestTrade(source.quotes).buyVenue).toBe('gamma')
})
