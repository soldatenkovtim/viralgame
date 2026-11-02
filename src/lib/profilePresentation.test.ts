import { describe, expect, it } from 'vitest'
import { observationEvidence, profileObservations, shareCardTraits, traitEvidence, traitExplanations } from './profilePresentation'
import { observationFinding } from './profileEvidence'
import { allArchetypeNames, archetypeTagline, resolveArchetype, traitOrder } from './profile'
import { crossArbitrageScenarios, crossArbitrageSessions } from '@/data/crossArbitrageScenarios'
import { bestTrade, buildQuotePath } from '@/games/cross-arbitrage/engine'
import { buildCrossArbitrageResult, evaluateRound } from '@/games/cross-arbitrage/scoring'
import { decisionsFromActions } from '@/games/market-shock/engine'
import { getMarketShockScenario } from '@/games/market-shock/scenarios'
import { buildMarketShockResult } from '@/games/market-shock/scoring'
import type { ArbitrageRoundResult, BlindMarketResult, MarketMakerResult, TradingProfile } from '@/types/game'

const profile: TradingProfile = { marketSense: 55, riskControl: 87, pricing: 35, adaptability: 53, discipline: 69, opportunity: 46, archetype: 'Дисциплинированный риск-менеджер', description: '' }
const arbitrage = (rounds: ArbitrageRoundResult[]) => buildCrossArbitrageResult(crossArbitrageSessions[0], rounds)
const falseScenario = crossArbitrageScenarios.find(s => s.kind === 'false')!
const goodScenario = crossArbitrageScenarios.find(s => s.kind === 'obvious' && !s.dynamic)!
function trade(scenario = falseScenario, positionSize = 1, decisionTimeMs = 2500) {
  const best = bestTrade(scenario.quotes)
  return evaluateRound(scenario, { buyVenue: best.buyVenue, sellVenue: best.sellVenue, positionSize, decisionTimeMs, timedOut: false })
}
const pass = (scenario = falseScenario, timedOut = false, decisionTimeMs = 2500) => evaluateRound(scenario, { positionSize: 0, decisionTimeMs, timedOut })
const blind = (returns: number[], exposures: number[]): BlindMarketResult => ({
  scenarioId: 'test', seed: 1, pnl: 0, pnlPercent: 0, maxDrawdown: 0,
  selectedInformation: [], averageConfidence: 50, directionChanges: 0, timeToDecision: [], score: 0,
  segmentReturns: returns, decisions: exposures.map((exposure, checkpointIndex) => ({
    checkpointIndex, exposure, direction: exposure < 0 ? 'short' : 'long', confidence: 50, priceAtDecision: 100, timeMs: 5000,
  })),
})
const maker = (overrides: Partial<MarketMakerResult> = {}): MarketMakerResult => ({
  scenarioId: 'test', seed: 1, pnl: -1000, spreadPnl: 100, inventoryPnl: -900, hedgeCosts: 200,
  maxInventory: 32, tradeCount: 10, averageSpread: 0.5, adverseSelectionLoss: 1000,
  hedgeCount: 0, hedgedUnits: 0, finalInventory: 32, spreadChanges: 0, quoteMoves: 0,
  secondsAboveSoftLimit: 25, inventoryResponseSeconds: null, spreadFirstHalf: 0.5,
  spreadSecondHalf: 0.5, spreadNoise: 0.5, spreadDirectional: 0.5, phases: [], score: 0, ...overrides,
})

describe('profile presentation', () => {
  it('keeps each pair archetype tied to its two leading traits', () => {
    expect(shareCardTraits(profile)).toEqual(['riskControl', 'discipline', 'marketSense'])
    for (const first of traitOrder) for (const second of traitOrder.filter(t => t !== first)) {
      const values = { ...profile, ...Object.fromEntries(traitOrder.map(t => [t, 40])), [first]: 90, [second]: 80 }
      expect(shareCardTraits({ ...values, archetype: resolveArchetype(values, {}).name }).slice(0, 2)).toEqual([first, second])
    }
  })
  it('does not assert unobserved actions from pair archetypes, including full exposure', () => {
    const values = { ...profile, marketSense: 95, riskControl: 94 }
    const archetype = resolveArchetype(values, { blindMarket: blind([1, 1, 1], [1, 1, 1]) })
    expect(archetype.name).toBe('Осторожный охотник')
    expect(archetype.tagline).toContain('ведущие показатели')
    for (const name of allArchetypeNames) {
      expect(archetypeTagline(name)).not.toMatch(/никогда|всегда|каждый раз|раньше остальных|не боитесь|не отходите|только тот/)
    }
  })
  it('requires an actual high-exposure choice for the opportunist exception', () => {
    const scenario = getMarketShockScenario('shock_trend_collapse')
    const result = buildMarketShockResult(scenario, decisionsFromActions(scenario, ['hold', 'hedge', 'increase'], 5200), [])
    const values = { ...profile, marketSense: 95, riskControl: 94 }
    const base = { ...result, maxExposure: 1 }
    // A large starting position alone is not a user decision.
    expect(resolveArchetype(values, { blackSwan: base }).name).not.toBe('Оппортунист')
    const decision = { ...result.decisions[0], positionBefore: 1, positionAfter: 1, action: 'hold' as const }
    expect(resolveArchetype(values, { blackSwan: { ...base, decisions: [decision] } }).name).toBe('Оппортунист')
    expect(resolveArchetype(values, { blackSwan: { ...base, decisions: [{ ...decision, timedOut: true }] } }).name).not.toBe('Оппортунист')
  })
  it('falls back to the calculated characteristic when decision data is absent', () => {
    const result = profileObservations(profile, {})
    expect(result.strengths.map(o => o.value)).toEqual([87, 69])
    expect(result.growth.map(o => o.value)).toEqual([35, 46])
    expect(result.strengths[0].text).toContain('Расчётная характеристика — 87/100')
    expect(traitEvidence('riskControl', {})).toBeNull()
  })
  it('does not manufacture strengths or weaknesses for identical scores', () => {
    const tied = { ...profile, ...Object.fromEntries(traitOrder.map(t => [t, 58])) }
    expect(profileObservations(tied, {})).toEqual({ strengths: [], growth: [] })
    expect(new Set(shareCardTraits(tied)).size).toBe(3)
  })
  it('ties discipline growth to a fee trap at decision time, not a final loss', () => {
    const round = trade()
    expect(round.grossReturn).toBeGreaterThan(0)
    expect(round.netBeforeLiquidity).toBeLessThan(0)
    const input = { crossArbitrage: arbitrage([round]) }
    expect(observationEvidence('discipline', input, false)).toContain('Комиссии превышали ценовое преимущество')
    expect(observationEvidence('discipline', input, false)).toContain('раунд 01')
    expect(observationEvidence('discipline', input, true)).toBeNull()
    expect(profileObservations(profile, input).strengths.find(o => o.trait === 'discipline')?.text).toContain('Расчётная характеристика')
  })
  it('ignores unrelated final profit/loss flags when explaining discipline', () => {
    const round = trade(goodScenario)
    expect(round.netReturn).toBeGreaterThan(0)
    const input = { crossArbitrage: arbitrage([{ ...round, capitalReturn: -1, profitable: false }]) }
    expect(observationEvidence('discipline', input, false)).toBeNull()
    expect(observationEvidence('discipline', input, true)).toContain('в момент решения')
  })
  it('does not equate a timeout with an intentional refusal', () => {
    expect(observationEvidence('discipline', { crossArbitrage: arbitrage([pass()]) }, true)).toContain('вы выбрали «Сделки нет»')
    const timed = { crossArbitrage: arbitrage([pass(falseScenario, true)]) }
    expect(observationEvidence('discipline', timed, true)).toBeNull()
    expect(observationEvidence('adaptability', timed, false)).toContain('время на решение истекло')
  })
  it('identifies volume that consumes an otherwise positive edge', () => {
    const small = crossArbitrageScenarios.find(s => s.kind === 'small')!
    const input = { crossArbitrage: arbitrage([trade(small, 1)]) }
    expect(input.crossArbitrage.rounds[0].netBeforeLiquidity).toBeGreaterThan(0)
    expect(input.crossArbitrage.rounds[0].netReturn).toBeLessThanOrEqual(0)
    expect(observationEvidence('discipline', input, false)).toContain('доступной глубине')
  })
  it('compares opportunities at the decision step, not at the initial quotes', () => {
    const input = { crossArbitrage: arbitrage([pass(goodScenario)]) }
    expect(observationEvidence('opportunity', input, false)).toContain('в тот момент котировкам')
    const best = bestTrade(goodScenario.quotes)
    expect(observationEvidence('opportunity', { crossArbitrage: arbitrage([trade(goodScenario, best.positionSize)]) }, true)).toContain('максимальный расчётный вклад')
    const dynamic = crossArbitrageScenarios.find(s => s.dynamic && bestTrade(buildQuotePath(s).at(-1)!).capitalReturn <= 0)!
    expect(dynamic).toBeDefined()
    const late = { crossArbitrage: arbitrage([pass(dynamic, false, 14000)]) }
    expect(observationEvidence('opportunity', late, false)).toBeNull()
    const unknown = { crossArbitrage: arbitrage([{ ...pass(goodScenario), scenarioId: 'missing' }]) }
    expect(observationEvidence('opportunity', unknown, false)).toBeNull()
  })
  it('reports the actual 60% to 21% reduction, independent of final profit', () => {
    const scenario = getMarketShockScenario('shock_trend_collapse')
    const result = buildMarketShockResult(scenario, decisionsFromActions(scenario, ['hold', 'hedge', 'increase'], 5200), [])
    const input = { blackSwan: { ...result, pnlPercent: -20 } }
    const text = observationEvidence('riskControl', input, true)
    expect(text).toContain('с 60% до 21%')
    expect(text).toContain('решение 2')
    expect(text).not.toContain('правильно')
    const timed = { blackSwan: { ...result, decisions: result.decisions.map(d => ({ ...d, timedOut: true })) } }
    expect(observationEvidence('riskControl', timed, true)).toBeNull()
  })
  it('labels market alignment as retrospective, with the actual direction and size', () => {
    const good = { blindMarket: blind([1, 2, 3], [0.25, 0.5, 0.75]) }
    const bad = { blindMarket: blind([1, 2, 3], [-0.25, -0.5, -0.75]) }
    expect(observationEvidence('marketSense', good, true)).toContain('Лонг 25%')
    expect(observationEvidence('marketSense', good, true)).toContain('только после решения')
    expect(observationEvidence('marketSense', bad, false)).toContain('Шорт 25%')
    expect(observationEvidence('adaptability', good, true)).toContain('Лонг 25% на Лонг 50%')
    expect(observationEvidence('adaptability', good, true)).toContain('не оценка правильности решения заранее')
    expect(observationEvidence('adaptability', bad, false)).toContain('снизило')
    for (const trait of ['marketSense', 'adaptability'] as const) {
      expect(observationEvidence(trait, good, false)).toBeNull()
      expect(observationEvidence(trait, bad, true)).toBeNull()
      expect(observationEvidence(trait, { blindMarket: blind([NaN], [1]) }, true)).toBeNull()
    }
  })
  it('keeps the compact thesis and expanded proof tied to the same decision', () => {
    const scenario = getMarketShockScenario('shock_trend_collapse')
    const result = buildMarketShockResult(scenario, decisionsFromActions(scenario, ['hold', 'hedge', 'increase'], 5200), [])
    const observation = profileObservations(profile, { blackSwan: result }).strengths.find(o => o.trait === 'riskControl')!
    expect(observation.summary).toContain('60% → 21%')
    expect(observation.text).toContain('решение 2')
    expect(observation.text).toContain('с 60% до 21%')
    const feeTrap = observationFinding('discipline', { crossArbitrage: arbitrage([trade()]) }, false)!
    expect(feeTrap.summary).toContain('комиссии превышали')
    expect(feeTrap.detail).toContain('Комиссии превышали')
  })
  it('describes a long before a 6.8% rise as an outcome, not proof of analytical skill', () => {
    const evidence = observationFinding('marketSense', { blindMarket: blind([6.8], [0.5]) }, true)!
    expect(evidence.summary).toBe('В слепом рынке Лонг 50% совпал с последующим движением.')
    expect(evidence.detail).toContain('+6,8%')
    expect(evidence.detail).toContain('сам по себе не подтверждает качество анализа или навык прогнозирования')
    expect(evidence.detail).not.toContain('повысило оценку')
  })
  it('does not mistake a reopening after a stop for a voluntary position adjustment', () => {
    const result = blind([1, 2], [0.25, 0.5])
    result.stopHits = [{ segment: 0, price: 99, candleIndex: 0 }]
    expect(observationEvidence('adaptability', { blindMarket: result }, true)).toBeNull()
  })
  it('uses visible market price rather than hidden fair value for pricing evidence', () => {
    const result = maker({ trades: [{ tick: 12, botSide: 'buy', size: 2, price: 101, marketPriceAtTrade: 100, fairValueAtTrade: 150, inventoryAfter: -2, increasedRisk: true, markout: 100, regime: 'noise' }] })
    const text = observationEvidence('pricing', { marketMaker: result }, true)
    expect(text).toContain('продали 2 лотов по 101,00 при рыночной цене 100,00')
    expect(text).not.toContain('150')
    expect(text).toContain('до комиссий')
  })
  it('does not praise gross spread income when losses consumed it', () => {
    const input = { marketMaker: maker() }
    expect(observationEvidence('pricing', input, true)).toBeNull()
    expect(observationEvidence('pricing', input, false)).toContain('-1')
    expect(observationEvidence('riskControl', input, true)).toBeNull()
    expect(observationEvidence('riskControl', input, false)).toContain('25,0 с')
  })
  it('keeps weak profiles neutral and never mutates stored results', () => {
    const input = { blindMarket: blind([1, 2, 3], [-0.25, -0.5, -0.75]), marketMaker: maker(), crossArbitrage: arbitrage([trade()]) }
    const before = structuredClone(input)
    const weak = { ...profile, marketSense: 25, riskControl: 22, pricing: 20, adaptability: 26, discipline: 24, opportunity: 21 }
    expect(profileObservations(weak, input).strengths.every(o => o.text.includes('Расчётная характеристика'))).toBe(true)
    for (const trait of traitOrder) expect(observationEvidence(trait, input, true)).toBeNull()
    expect(input).toEqual(before)
  })
  it('gives each trait a meaning, inputs and score interpretation', () => {
    for (const trait of traitOrder) {
      expect(traitExplanations[trait].meaning.length).toBeGreaterThan(20)
      expect(traitExplanations[trait].sources.length).toBeGreaterThan(20)
      expect(traitExplanations[trait].interpretation).toMatch(/^Выше/)
    }
  })
})
