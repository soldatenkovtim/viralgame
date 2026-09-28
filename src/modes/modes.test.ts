import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DuelLanding } from '@/duel/DuelLanding'
vi.hoisted(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } })
})
import { useGameStore, type ResultPayload } from '@/store/gameStore'
import { scenarioCatalog, selectScenario } from './scenarios'
import { advancedArbitrageScenarios, advancedMakerScenarios, advancedShockScenarios } from '@/data/advanced/scenarios'
import { createDuel, encodeDuel } from '@/duel/createDuel'
import { decodeDuel } from '@/duel/decodeDuel'
import { MarketMakerEngine } from '@/games/market-maker/engine'
import { buildMarketPaths } from '@/games/market-maker/market'
import { computeBlindMarket } from '@/games/blind-market/scoring'
import { buildMarketShockResult } from '@/games/market-shock/scoring'
import { decisionsFromActions } from '@/games/market-shock/engine'
import { buildCrossArbitrageResult, evaluateRound } from '@/games/cross-arbitrage/scoring'
import { bestTrade, buildQuotePath, evaluateTrade, executionPrice, quoteStepAt } from '@/games/cross-arbitrage/engine'
import { sessionScenarios } from '@/data/crossArbitrageScenarios'
import type { BlindDecision, ChallengeType } from '@/types/game'
const types = Object.keys(scenarioCatalog) as ChallengeType[]
export function sampleResult(type: ChallengeType, advanced = false): ResultPayload {
  switch (type) {
    case 'blind-market': {
      const s = selectScenario(type, advanced, 0)
      const decisions: BlindDecision[] = s.checkpoints.map((c, i) => ({ checkpointIndex: i, direction: 'long',
        exposure: 0.5, confidence: 70, priceAtDecision: s.candles[c - 1].close, timeMs: 4000, ...(i > 0 ? { action: 'hold' as const } : {}) }))
      return { challengeType: type, result: { ...computeBlindMarket(s, decisions), scenarioId: s.id, seed: s.seed,
        decisions, selectedInformation: [], timeToDecision: decisions.map(d => d.timeMs) } }
    }
    case 'market-maker': {
      const engine = new MarketMakerEngine(selectScenario(type, advanced, 0))
      while (!engine.finished) engine.tick()
      return { challengeType: type, result: engine.buildResult() }
    }
    case 'black-swan': {
      const s = selectScenario(type, advanced, 0)
      return { challengeType: type, result: buildMarketShockResult(s, decisionsFromActions(s, ['hold', 'hedge', 'close']), []) }
    }
    case 'cross-arbitrage': {
      const s = selectScenario(type, advanced, 0)
      return { challengeType: type, result: buildCrossArbitrageResult(s, sessionScenarios(s).map(r => evaluateRound(r, { positionSize: 0, decisionTimeMs: 4000, timedOut: false }))) }
    }
  }
}
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); useGameStore.getState().resetProgress() })
describe('Раздельный прогресс и миграция', () => {
  it('открывает режимы только после требуемого прогресса и сохраняет через localStorage', () => {
    const store = useGameStore.getState()
    store.setMode('advanced'); expect(useGameStore.getState().selectedMode).toBe('standard')
    store.setMode('duel'); expect(useGameStore.getState().selectedMode).toBe('duel')
    store.saveResult(sampleResult('blind-market'))
    store.setMode('duel'); expect(useGameStore.getState().selectedMode).toBe('duel')
    store.saveResult(sampleResult('blind-market'))
    expect(useGameStore.getState().advancedUnlocked).toBe(false)
    types.slice(1).forEach(t => store.saveResult(sampleResult(t)))
    expect(useGameStore.getState().advancedUnlocked).toBe(true)
    store.setMode('advanced')
    expect(JSON.parse(localStorage.getItem('market-trials-v1')!).state.selectedMode).toBe('advanced')
    expect(console.log).toHaveBeenCalledWith('[analytics]', 'advanced_unlocked', expect.anything())
  })
  it('advanced не меняет standard профиль, попытки, рекорды и разблокировки', () => {
    const before = useGameStore.getState()
    before.saveResult(sampleResult('black-swan', true), 'advanced')
    const after = useGameStore.getState()
    expect(after.advancedResults).toHaveLength(1)
    expect(after.standardResults).toEqual([])
    expect(after.personalBests).toEqual(before.personalBests)
    expect(after.attempts).toEqual(before.attempts)
    expect(after.unlockedChallenges).toEqual(['blind-market'])
    expect(after.blackSwanResult).toBeUndefined()
    expect(after.advancedUnlocked).toBe(false)
  })
  it('переносит старый прогресс и сохраняет открытый Advanced после перезапуска серии', async () => {
    types.forEach(t => useGameStore.getState().saveResult(sampleResult(t)))
    const state = useGameStore.getState()
    const migrated = await useGameStore.persist.getOptions().migrate!({ ...state, advancedUnlocked: undefined, standardResults: undefined }, 4) as typeof state
    expect(migrated.advancedUnlocked).toBe(true)
    expect(migrated.standardResults).toHaveLength(4)
    state.restartSeries()
    expect(useGameStore.getState().advancedUnlocked).toBe(true)
    expect(useGameStore.getState().standardResults).toHaveLength(4)
  })
})
describe('Дуэль: точный сценарий и ограниченный payload', () => {
  it.each(types)('%s: приглашение не раскрывает результат или решения соперника', type => {
    const duel = createDuel(sampleResult(type))
    duel.challengerResult.score = 99.876543
    for (const key of Object.keys(duel.challengerResult.metrics)) duel.challengerResult.metrics[key] = 9876.54321
    duel.challengerResult.decisions.forEach(d => { d.label = 'СКРЫТОЕ РЕШЕНИЕ' })
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/duel/${type}?data=${encodeDuel(duel)}`] },
      createElement(Routes, null, createElement(Route, { path: '/duel/:challengeType', element: createElement(DuelLanding) }))))
    expect(html).toContain('Тебе бросили вызов')
    expect(html).toContain('Принять вызов')
    expect(html).not.toContain('9876')
    expect(html).not.toContain('СКРЫТОЕ РЕШЕНИЕ')
    expect(html).not.toContain('99.876543')
  })
  for (const advanced of [false, true]) it.each(types)(`%s: roundtrip, advanced=${advanced}`, type => {
    const result = sampleResult(type, advanced)
    const duel = createDuel(result)
    const encoded = encodeDuel(duel)
    expect(encoded).toMatch(/^[\w-]+$/)
    expect(encoded.length).toBeLessThan(8000)
    expect(decodeDuel(encoded, type)).toEqual(duel)
    expect(JSON.stringify(duel)).not.toMatch(/candles|timeline|annotations|trades/)
    const s = scenarioCatalog[type].find(s => s.id === duel.scenarioId)!
    expect(s.seed).toBe(duel.seed)
    expect(s.mode === 'advanced').toBe(advanced)
  })
  it('отклоняет испорченные ссылки, другой seed, тип, версию и неизвестный сценарий', () => {
    const good = createDuel(sampleResult('market-maker'))
    expect(decodeDuel('???')).toBeNull()
    expect(decodeDuel('a'.repeat(25000))).toBeNull()
    expect(decodeDuel(encodeDuel(good), 'black-swan')).toBeNull()
    for (const patch of [{ seed: 999 }, { version: 2 }, { scenarioId: 'absent' }, { challengerResult: {} }, { challengeType: '__proto__' }]) {
      expect(decodeDuel(encodeDuel({ ...good, ...patch } as typeof good))).toBeNull()
    }
  })
  it('цепочка сохраняет исходный рынок, заменяя только участника', () => {
    const original = createDuel(sampleResult('black-swan', true))
    const next = { ...original, challengerResult: { ...original.challengerResult, score: 51 } }
    const decoded = decodeDuel(encodeDuel(next))!
    expect(decoded.scenarioId).toBe(original.scenarioId)
    expect(decoded.seed).toBe(original.seed)
    expect(decoded.challengerResult.score).toBe(51)
  })
  it.each(advancedMakerScenarios)('$id: исполнения независимы, внешний рынок одинаков', s => {
    const passive = new MarketMakerEngine(s)
    const active = new MarketMakerEngine(s)
    while (!passive.finished) {
      passive.tick(); active.moveQuotes(1); active.tick()
      if (active.snapshot().tick % 10 === 0) active.hedge()
      expect(active.snapshot().marketPrice).toBe(passive.snapshot().marketPrice)
    }
    expect(buildMarketPaths(s, 125)).toEqual(buildMarketPaths(s, 125))
    expect(active.buildResult().timeline!.map(t => t.fairValue)).toEqual(passive.buildResult().timeline!.map(t => t.fairValue))
  })
})
describe('Экономика Advanced', () => {
  it.each(advancedMakerScenarios)('$id: умеренный рост расходов и отсутствие мгновенного разгона inventory', s => {
    const advanced = new MarketMakerEngine(s)
    const standard = new MarketMakerEngine(selectScenario('market-maker', false, 0))
    expect(advanced.hedgeCostFor(10) / standard.hedgeCostFor(10)).toBeCloseTo(1.2)
    for (let tick = 0; tick < 40; tick++) advanced.tick()
    expect(advanced.buildResult().maxInventory).toBeLessThan(40)
  })
  it.each(advancedArbitrageScenarios)('$id: 5 площадок, 3 уровня, котировки и исполнение согласованы', s => {
    expect(s.quotes).toHaveLength(5)
    expect(s.durationSeconds).toBeLessThanOrEqual(10)
    const path = buildQuotePath(s)
    expect(buildQuotePath(s)).toEqual(path)
    const q = s.quotes[0]
    expect(executionPrice(q, 'buy', 100)).toBeGreaterThan(q.secondAsk!)
    expect(quoteStepAt(1749, path.length, s.quoteStepMs)).toBe(0)
    expect(quoteStepAt(1750, path.length, s.quoteStepMs)).toBe(1)
    const best = bestTrade(s.quotes)
    const result = evaluateRound(s, { buyVenue: best.buyVenue, sellVenue: best.sellVenue, positionSize: 0.25, decisionTimeMs: 3500, timedOut: false })
    expect(result.netReturn).toBe(evaluateTrade(path[2], best.buyVenue, best.sellVenue, 0.25).netReturn)
  })
  it('есть рынки с несколькими маршрутами и штрафом за избыточный размер', () => {
    expect(advancedArbitrageScenarios.some(s => {
      const best = bestTrade(s.quotes)
      return best.positionSize < 1 && best.capitalReturn > 0 && evaluateTrade(s.quotes, best.buyVenue, best.sellVenue, 1).capitalReturn < 0
    })).toBe(true)
  })
  it('закрытие позиции в Advanced Shock сохраняет результат до конца рынка', () => {
    for (const s of advancedShockScenarios) {
      const decisions = decisionsFromActions(s, ['close'])
      const a = buildMarketShockResult(s, decisions, [])
      const altered = { ...s, candles: s.candles.map((c, i) => i >= s.phaseCheckpoints[0] ? { ...c, close: c.close * 2 } : c) }
      expect(buildMarketShockResult(altered, decisions, []).pnl).toBeCloseTo(a.pnl)
    }
  })
})
