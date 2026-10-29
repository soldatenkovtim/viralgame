import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { blindMarketScenarios, getBlindScenario } from '@/data/blindMarketScenarios'
import { advancedBlindScenarios } from '@/data/advanced/scenarios'
import { blindMarketAchievement } from '@/lib/achievements'
import { buildDescription, buildTradingProfile, CONTRARIAN, refreshProfileNarrative, resolveArchetype, traitOrder } from '@/lib/profile'
import { findScenarioById } from '@/modes/scenarios'
import type { BlindDecision, BlindMarketResult, BlindMarketScenario } from '@/types/game'
import { classifyPositionChange, isReversal, positionEvents } from './positionAnalysis'
import { decisionObservation, scoreContributions } from './resultAnalysis'
import { blindTraits, computeBlindMarket } from './scoring'
import { BlindMarketResult as ResultScreen } from './BlindMarketResult'

function resultFor(exposures: number[], scenario = blindMarketScenarios[2]): BlindMarketResult {
  const decisions: BlindDecision[] = exposures.map((exposure, checkpointIndex) => ({
    checkpointIndex, exposure, confidence: 70, timeMs: 3000,
    direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat',
    priceAtDecision: scenario.candles[scenario.checkpoints[checkpointIndex] - 1].close,
  }))
  return { ...computeBlindMarket(scenario, decisions), decisions,
    scenarioId: scenario.id, seed: scenario.seed, selectedInformation: [], timeToDecision: [3000, 3000, 3000] }
}

const neutralTraits = { marketSense: 50, riskControl: 50, pricing: 50, adaptability: 50, discipline: 50, opportunity: 50 }
afterEach(() => vi.restoreAllMocks())

describe('position events and factual profile narratives', () => {
  it.each([
    [[0, 0, 0], ['flat', 'flat', 'flat']],
    [[0, 0.25, 0], ['flat', 'open-long', 'close']],
    [[0, -0.25, 0], ['flat', 'open-short', 'close']],
    [[0.25, -0.25, -0.25], ['open-long', 'reverse-short', 'hold']],
    [[-0.25, 0.25, 0.25], ['open-short', 'reverse-long', 'hold']],
    [[0.25, 0.5, 1], ['open-long', 'increase', 'increase']],
    [[-0.25, -0.5, -1], ['open-short', 'increase', 'increase']],
    [[0.25, 0.125, 0.0625], ['open-long', 'reduce', 'reduce']],
    [[-0.5, -0.25, -0.125], ['open-short', 'reduce', 'reduce']],
    [[0.25, 0, -0.25], ['open-long', 'close', 'open-short']],
  ])('classifies %j independently of legacy directionChanges', (exposures, expected) => {
    const result = resultFor(exposures as number[])
    expect(positionEvents(result.decisions)).toEqual(expected)
    const description = buildDescription({ blindMarket: result })
    if (!expected.some(event => event.startsWith('reverse'))) expect(description).not.toContain('развернули')
    else expect(description).toContain('развернули позицию из')
    expect(description).not.toMatch(/пошло против|новая информация|правильн|осторожн/)
  })

  it('describes a fully passive session without motives or a chosen direction', () => {
    const result = resultFor([0, 0, 0])
    expect(buildDescription({ blindMarket: result })).toBe('Вы прошли сценарий, не открывая торговых позиций. Капитал остался вне рынка на протяжении всех трёх решений.')
    expect(buildDescription({ blindMarket: { ...result, decisions: result.decisions.slice(0, 2) } })).not.toContain('всех трёх')
  })

  it.each([[0, 0.25, 0], [0, -0.25, 0]])('does not assign contrarian for entry/exit %j even with a positive PnL', (...exposures) => {
    const result = { ...resultFor(exposures), directionChanges: 2, pnlPercent: 1 }
    expect(resolveArchetype(neutralTraits, { blindMarket: result })).not.toBe(CONTRARIAN)
  })

  it('requires actual reversals against already observed price movement for contrarian', () => {
    const result = { ...resultFor([0.25, -0.25, 0.25]), pnlPercent: 1 }
    result.decisions.forEach((decision, index) => { decision.priceAtDecision = [100, 110, 100][index] })
    expect(positionEvents(result.decisions).filter(isReversal)).toHaveLength(2)
    expect(resolveArchetype(neutralTraits, { blindMarket: result })).toBe(CONTRARIAN)
    result.decisions[1].priceAtDecision = 90
    expect(resolveArchetype(neutralTraits, { blindMarket: result })).not.toBe(CONTRARIAN)
    result.decisions[1].priceAtDecision = NaN
    expect(resolveArchetype(neutralTraits, { blindMarket: result })).not.toBe(CONTRARIAN)
  })

  it('refreshes a saved false archetype without altering any saved data or numeric traits', () => {
    const result = resultFor([0, 0.25, 0])
    const saved = { ...buildTradingProfile({ blindMarket: result }), archetype: CONTRARIAN.name, description: 'Старый текст' }
    const before = structuredClone({ result, saved })
    const refreshed = refreshProfileNarrative(saved, { blindMarket: result })
    expect(refreshed.archetype).not.toBe(CONTRARIAN.name)
    expect(refreshed.description).toContain('открыли лонг, затем закрыли позицию')
    for (const trait of traitOrder) expect(refreshed[trait]).toBe(saved[trait])
    expect({ result, saved }).toEqual(before)
  })

  it('does not invent a transition for incomplete or invalid historical data', () => {
    expect(classifyPositionChange(undefined, 0.25)).toBe('unknown')
    expect(classifyPositionChange(NaN, 0)).toBe('unknown')
    const result = resultFor([0.25, -0.25, 0])
    expect(positionEvents(result.decisions.slice(1))).toEqual(['unknown', 'close'])
    expect(positionEvents([result.decisions[0], result.decisions[2]])).toEqual(['open-long', 'unknown'])
  })
})

describe('achievements describe evidence, not trading skill', () => {
  it.each([undefined, null, NaN, Infinity, -Infinity])('does not turn missing/invalid market return %s into zero', value => {
    const result = { ...resultFor([0, 0, 0]), segmentReturns: [value, value, value] } as BlindMarketResult
    expect(blindMarketAchievement(result)).toBeNull()
    expect(decisionObservation(result.decisions[0], value, false, 'flat')).toBeNull()
  })

  it('handles missing and truncated arrays in old results', () => {
    const result = resultFor([0, 0, 0])
    for (const segmentReturns of [undefined, null, []]) {
      expect(blindMarketAchievement({ ...result, segmentReturns } as BlindMarketResult)).toBeNull()
    }
    expect(blindMarketAchievement({ ...result, segmentReturns: [2] })).toBeNull()
  })

  it.each([1.499, -1.499])('keeps eligibility below 1.5%% but describes the actual interval %s', value => {
    const result = { ...resultFor([0, 0, 0]), segmentReturns: [2, value, 2] }
    const fact = blindMarketAchievement(result)!
    expect(fact.id).toBe('stayed-out')
    expect(fact.description).toContain('В точке решения 2')
    expect(fact.description).toContain(value > 0 ? 'цена выросла' : 'цена снизилась')
    expect(fact.description).not.toMatch(/почти не было|правильн|ошиб/)
  })

  it.each([1.5, 1.501, -1.5, -1.501])('does not change the original 1.5%% eligibility threshold: %s', value => {
    expect(blindMarketAchievement({ ...resultFor([0, 0, 0]), segmentReturns: [value, value, value] })).toBeNull()
  })

  it('describes a specific 1.4% move instead of calling it negligible', () => {
    const fact = blindMarketAchievement({ ...resultFor([0, 0, 0]), segmentReturns: [2, 1.4, 2] })!
    expect(fact.description).toBe('В точке решения 2 вы остались вне рынка. До следующей точки цена выросла на 1,4%.')
  })

  it('identifies the final interval, without extrapolating to the whole session', () => {
    const fact = blindMarketAchievement({ ...resultFor([0, 0, 0]), segmentReturns: [2, 2, -0.8] })!
    expect(fact.description).toBe('В точке решения 3 вы остались вне рынка. До завершения сценария цена снизилась на 0,8%.')
  })

  it('does not call a nonzero drawdown zero or confuse capital drawdown with a position loss', () => {
    const result = { ...resultFor([0, 0, 0]), segmentReturns: [2, 2, 2], pnlPercent: 1, maxDrawdown: 1.1 }
    const fact = blindMarketAchievement(result)!
    expect(fact.title).toBe('Небольшая просадка')
    expect(fact.description).toContain('просадка капитала от достигнутого пика составила 1,1%')
    expect(blindMarketAchievement({ ...result, maxDrawdown: 1.2 })).toBeNull()
    expect(blindMarketAchievement({ ...result, maxDrawdown: null } as unknown as BlindMarketResult)).toBeNull()
  })
})

describe('exact scenario lookup for achievements', () => {
  it.each([...blindMarketScenarios, ...advancedBlindScenarios])('$mode / $asset.name: uses its own market and checkpoints', scenario => {
    expect(findScenarioById('blind-market', scenario.id, scenario.mode)).toBe(scenario)
    const otherMode = scenario.mode === 'advanced' ? 'standard' : 'advanced'
    expect(findScenarioById('blind-market', scenario.id, otherMode)).toBeUndefined()
    // Entry exactly at this market's future minimum must qualify; Apple prices
    // would not satisfy this condition for Advanced NVIDIA or Bitcoin.
    const result = resultFor([0.25, 0.25, 0.25], scenario)
    result.decisions[0].priceAtDecision = Math.min(...scenario.candles.slice(scenario.checkpoints[0]).map(c => c.low))
    result.pnlPercent = 0 // isolate the extremum criterion
    expect(blindMarketAchievement(result, scenario.mode)).toMatchObject({ id: 'caught-reversal', title: 'Вход рядом с экстремумом' })
    expect(blindMarketAchievement(result, scenario.mode)?.description).toContain('последующего участка до конца сценария')
    expect(blindMarketAchievement(result, otherMode)).toBeNull()
  })

  it('never silently substitutes Apple for an unknown scenario', () => {
    expect(findScenarioById('blind-market', 'unknown')).toBeUndefined()
    expect(getBlindScenario(blindMarketScenarios[0].id)).toBe(blindMarketScenarios[0])
    expect(() => getBlindScenario('unknown')).toThrow('Unknown standard blind-market scenario')
    const result = resultFor([0.25, 0.25, 0.25], blindMarketScenarios[0])
    result.decisions[0].priceAtDecision = Math.min(...blindMarketScenarios[0].candles.map(c => c.low))
    expect(blindMarketAchievement({ ...result, scenarioId: 'unknown', pnlPercent: 0 })).toBeNull()
  })
})

describe('financial regressions and executed stops', () => {
  it('still gives exactly 6,400 points at zero PnL and zero drawdown', () => {
    const result = resultFor([0, 0, 0])
    expect(result.pnl).toBe(0)
    expect(result.maxDrawdown).toBe(0)
    expect(result.score * 100).toBe(6400)
    expect(scoreContributions(0, 0).returnPoints).toBeCloseTo(3600, 10)
    expect(scoreContributions(0, 0).drawdownPoints).toBeCloseTo(2800, 10)
  })

  it('preserves the audited Bitcoin result, 6,833 points, and all financial data after analytics', () => {
    const result = resultFor([0, 0.25, 0])
    expect(result.pnl).toBeCloseTo(16587.11395411495, 8)
    expect(result.pnlPercent).toBeCloseTo(1.6587113954114951, 12)
    expect(result.maxDrawdown).toBeCloseTo(0.2765818047314759, 12)
    expect(Math.round(result.score * 100)).toBe(6833)
    const before = structuredClone(result)
    const traits = blindTraits(result)
    expect(traits.marketSense).toBeCloseTo(58.844311078184326, 10)
    expect(traits.adaptability).toBeCloseTo(61.19640968877505, 10)
    expect(traits.discipline).toBeCloseTo(92.83728004438612, 10)
    const profile = buildTradingProfile({ blindMarket: result })
    blindMarketAchievement(result)
    refreshProfileNarrative(profile, { blindMarket: result })
    result.decisions.forEach((decision, index) => decisionObservation(decision, result.segmentReturns[index], index === 2, positionEvents(result.decisions)[index]))
    expect(result).toEqual(before)
  })

  it('describes a stop before price recovery without claiming a profitable trade or a later reversal', () => {
    const closes = [100, 96, 102, 104, 106, 108, 110]
    const scenario: BlindMarketScenario = { ...blindMarketScenarios[0], checkpoints: [1, 3, 5],
      candles: closes.map((close, i) => ({ time: 1800000000 + i * 900, open: i ? closes[i - 1] : close,
        high: Math.max(close, i ? closes[i - 1] : close), low: Math.min(close, i ? closes[i - 1] : close), close, volume: 1000 })) }
    const base = resultFor([0.25, 0, 0], scenario)
    base.decisions[0].stopPrice = 98
    const result = { ...base, ...computeBlindMarket(scenario, base.decisions) }
    expect(result.pnlPercent).toBe(-0.5)
    expect(result.segmentReturns[0]).toBe(2)
    expect(result.stopHits).toEqual([{ segment: 0, candleIndex: 1, price: 98 }])
    const events = positionEvents(result.decisions, result.stopHits)
    expect(events).toEqual(['open-long', 'flat', 'flat'])
    const observation = decisionObservation(result.decisions[0], result.segmentReturns[0], false, events[0], result.stopHits[0])!
    expect(observation).toContain('движение цены за весь участок')
    expect(observation).toContain('после закрытия позиции по стопу')
    expect(observation).not.toMatch(/прибыл|заработ|правильн|надо было/)
    const reentry = [...result.decisions]
    reentry[1] = { ...reentry[1], exposure: -0.25, direction: 'short', action: 'enter-short' }
    expect(positionEvents(reentry, result.stopHits)).toEqual(['open-long', 'open-short', 'close'])
  })
})

describe('result screen rendering', () => {
  function renderResult(result: BlindMarketResult) {
    return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ResultScreen, {
      scenario: blindMarketScenarios[2], result,
      outcome: { points: Math.round(result.score * 100), previousBest: null, isPersonalBest: true,
        pointsToBest: 0, unlockedNext: 'market-maker', seriesCompleted: false },
      nextHref: '/challenge/market-maker', nextLabel: 'Открыть следующее испытание',
    })))
  }

  it('keeps explanation in the existing collapsed area and renders three factual decision cards', () => {
    const html = renderResult(resultFor([0, 0.25, 0]))
    expect(html).toContain('id="blind-score-explanation" class="blind-result-score" hidden=""')
    expect(html).toContain('6 400 очков: 3 600 за компонент доходности и 2 800 за компонент просадки')
    expect(html).toContain('не нормализованы по сложности и волатильности')
    expect(html).toContain('Уверенность не влияет напрямую на очки')
    expect(html).toContain('<h3>Вне рынка</h3>')
    expect(html).toContain('<h3>Открытие лонга · 25%</h3>')
    expect(html).toContain('<h3>Закрытие позиции</h3>')
    expect(html.match(/class="blind-result-decision-select"/g)).toHaveLength(3)
    expect(html).toContain('Испытание завершено.')
    expect(html).toContain('Что дальше')
    expect(html).toContain('aria-label="Точки торговых решений"')
    expect(html).not.toContain('После действия')
    expect(html).not.toContain('Размер позиции')
    expect(html).not.toContain('Вы открыли лонг')

  })

  it('renders absent, null and NaN outcomes as unavailable, without fictitious zero returns', () => {
    const result = { ...resultFor([0, 0, 0]), segmentReturns: [undefined, null, NaN] } as unknown as BlindMarketResult
    const html = renderResult(result)
    expect(html.match(/: нет данных/g)).toHaveLength(3)
    expect(html).not.toContain('цена не изменилась')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('там, где движения почти не было')
  })
})
