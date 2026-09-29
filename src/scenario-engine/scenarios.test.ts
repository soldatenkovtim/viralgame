import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { scenarioCatalog, scenarioById, scenarioPool, selectScenario } from '@/modes/scenarios'
import { useGameStore, CHALLENGE_ORDER } from '@/store/gameStore'
import { computeBlindMarket } from '@/games/blind-market/scoring'
import { buildMarketShockResult } from '@/games/market-shock/scoring'
import { decisionsFromActions } from '@/games/market-shock/engine'
import { MarketMakerEngine } from '@/games/market-maker/engine'
import { buildCrossArbitrageResult, evaluateRound } from '@/games/cross-arbitrage/scoring'
import { sessionScenarios } from '@/data/crossArbitrageScenarios'
import { createDuel, encodeDuel } from '@/duel/createDuel'
import { decodeDuel } from '@/duel/decodeDuel'
import { aggregateCandles, timeToLogical, logicalToTime } from '@/games/blind-market/timeframes'
import manifest from '@/scenarios/historical/manifest.json'
import type { BlindDecision, ChallengeType, OhlcvCandle } from '@/types/game'
vi.hoisted(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } })
})
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); useGameStore.getState().resetProgress() })
function blindResult(index = 0) {
  const scenario = scenarioPool('blind-market', 'standard')[index]
  const decisions: BlindDecision[] = scenario.checkpoints.map((checkpoint, i) => ({ checkpointIndex: i, direction: 'long', exposure: 0.5, confidence: 50, priceAtDecision: scenario.candles[checkpoint - 1].close, timeMs: 1000 }))
  return { ...computeBlindMarket(scenario, decisions), scenarioId: scenario.id, seed: scenario.seed, decisions, selectedInformation: [], timeToDecision: [1000, 1000, 1000] }
}
describe('Scenario pools and selection', () => {
  it.each(CHALLENGE_ORDER)('%s has exactly 3 enabled Standard alternatives and separate Advanced IDs', type => {
    const pool = scenarioPool(type, 'standard')
    expect(pool).toHaveLength(3)
    expect(new Set(pool.map(s => s.variant)).size).toBe(3)
    expect(new Set(pool.map(s => s.scoringProfile)).size).toBe(1)
    expect(pool.every(s => s.challengeType === type && s.enabled)).toBe(true)
    expect(scenarioPool(type, 'advanced').every(s => !pool.some(p => p.id === s.id))).toBe(true)
    const seen: string[] = []
    for (let i = 0; i < pool.length; i++) { const s = selectScenario(type, 'standard', seen); expect(seen).not.toContain(s.id); seen.push(s.id) }
    expect(pool).toContain(selectScenario(type, 'standard', seen))
    expect(selectScenario(type, 'standard', seen, undefined, seen[2]).id).not.toBe(seen[2])
  })
  it('first play can select every member, while explicit IDs never fall back to random', () => {
    const random = vi.spyOn(Math, 'random')
    for (const [index, value] of [0, 0.4, 0.99].entries()) { random.mockReturnValue(value); expect(selectScenario('blind-market', 'standard', []).id).toBe(scenarioPool('blind-market', 'standard')[index].id) }
    random.mockRestore()
    expect(() => scenarioById('blind-market', 'missing')).toThrow()
    expect(() => selectScenario('blind-market', 'advanced', [], 'blind-aapl-intraday-01')).toThrow()
  })
  it('duel roundtrip preserves every historical scenario and seed', () => {
    for (let i = 0; i < 3; i++) {
      const duel = createDuel({ challengeType: 'blind-market', result: blindResult(i) })
      expect(decodeDuel(encodeDuel(duel))).toEqual(duel)
      expect(scenarioById('blind-market', duel.scenarioId).seed).toBe(duel.seed)
    }
  })
})
describe('Persisted history and series', () => {
  it('records seen on start, completed on finish, and retains both on series restart', async () => {
    const store = useGameStore.getState()
    store.markScenarioStarted('blind-market', 'blind-aapl-intraday-01', 'standard')
    expect(useGameStore.getState().scenarioProgress['blind-market'].completedScenarioIds).toEqual([])
    store.saveResult({ challengeType: 'blind-market', result: blindResult() })
    store.restartSeries()
    await useGameStore.persist.rehydrate()
    const progress = useGameStore.getState().scenarioProgress['blind-market']
    expect(progress.seenScenarioIds).toEqual(['blind-aapl-intraday-01'])
    expect(progress.completedScenarioIds).toEqual(['blind-aapl-intraday-01'])
    expect(progress.lastScenarioId).toBe('blind-aapl-intraday-01')
    expect(selectScenario('blind-market', 'standard', progress.seenScenarioIds).id).not.toBe('blind-aapl-intraday-01')
    expect(useGameStore.getState().completedChallenges).toEqual([])
  })
  it('one scenario per challenge completes the series; a single replay leaves profile and source results unchanged', () => {
    const store = useGameStore.getState()
    store.saveResult({ challengeType: 'blind-market', result: blindResult() })
    const maker = new MarketMakerEngine(scenarioPool('market-maker', 'standard')[0]); while (!maker.finished) maker.tick()
    store.saveResult({ challengeType: 'market-maker', result: maker.buildResult() })
    const shock = scenarioPool('black-swan', 'standard')[0]
    store.saveResult({ challengeType: 'black-swan', result: buildMarketShockResult(shock, decisionsFromActions(shock, ['hold', 'hedge', 'close']), []) })
    const arb = scenarioPool('cross-arbitrage', 'standard')[0]
    store.saveResult({ challengeType: 'cross-arbitrage', result: buildCrossArbitrageResult(arb, sessionScenarios(arb).map(s => evaluateRound(s, { positionSize: 0, decisionTimeMs: 1000, timedOut: false }))) })
    const before = useGameStore.getState()
    expect(before.completedChallenges).toHaveLength(4)
    expect(before.tradingProfile).toBeDefined()
    expect(before.standardResults).toHaveLength(4)
    store.saveResult({ challengeType: 'blind-market', result: blindResult(1) })
    const after = useGameStore.getState()
    expect(after.tradingProfile).toBe(before.tradingProfile)
    expect(after.blindMarketResult).toBe(before.blindMarketResult)
    expect(after.seriesCompletedAt).toBe(before.seriesCompletedAt)
    expect(after.standardResults.at(-1)).toMatchObject({ scenarioId: 'blind-nvda-intraday-01', mode: 'standard', rawScore: expect.any(Number), normalizedScore: expect.any(Number) })
    expect(after.standardResults.at(-1)!.normalizedScore).toBe(after.standardResults.at(-1)!.rawScore)
  })
  it('migrates v5 completed IDs into separate mode histories', async () => {
    const state = useGameStore.getState()
    const result = { challengeType: 'blind-market' as ChallengeType, scenarioId: 'blind_01', score: 42, completedAt: '2026-01-01' }
    const migrated = await useGameStore.persist.getOptions().migrate!({ ...state, standardResults: [result], advancedResults: [{ ...result, scenarioId: 'advanced_blind_1' }] }, 5) as typeof state
    expect(migrated.scenarioProgress['blind-market'].completedScenarioIds).toEqual(['blind_01'])
    expect(migrated.advancedScenarioProgress['blind-market'].completedScenarioIds).toEqual(['advanced_blind_1'])
  })
})
describe('Historical OHLCV provenance and chart geometry', () => {
  it.each(manifest)('$file exactly preserves provider OHLCV, including volume and split adjustments', source => {
    const path = `src/scenarios/historical/${source.file}`
    const raw = readFileSync(path.replace('.json', '.source.json'))
    expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sourceSha256)
    const response = JSON.parse(raw.toString()).chart.result[0]
    const quotes = response.indicators.quote[0]
    const candles: OhlcvCandle[] = JSON.parse(readFileSync(path, 'utf8'))
    expect(candles).toHaveLength(source.candles)
    for (const c of candles) {
      const sourceIndex = response.timestamp.findIndex((t: number) => (source.interval === '15m' ? t : Math.floor(t / 86400) * 86400) === c.time)
      expect(sourceIndex).toBeGreaterThanOrEqual(0)
      for (const key of ['open', 'high', 'low', 'close', 'volume'] as const) expect(c[key]).toBe(quotes[key][sourceIndex])
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close))
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close))
    }
  })
  it('all historical pools use original datasets and entry prices; aggregation excludes future bars', () => {
    for (const s of [...scenarioCatalog['blind-market'], ...scenarioCatalog['black-swan']]) {
      expect(['15m', '1d']).toContain(s.baseTimeframe)
      const count = 'checkpoints' in s ? s.checkpoints[0] : s.initialVisibleIndex
      expect(count).toBeGreaterThan(0)
      const weekly = aggregateCandles(s.candles, count, 7 * 86400)
      expect(weekly.at(-1)!.close).toBe(s.candles[count - 1].close)
      expect(weekly.reduce((sum, c) => sum + c.volume, 0)).toBe(s.candles.slice(0, count).reduce((sum, c) => sum + c.volume, 0))
      if ('initialPosition' in s) { expect(s.synthetic).toBe(false); expect(s.initialPosition.entryPrice).toBe(s.candles[s.initialVisibleIndex - 1].close) }
    }
  })
  it('places markers and trend endpoints on real bars across weekends', () => {
    const bars = scenarioPool('blind-market', 'standard')[0].candles
    const origin = bars[0].time
    for (let i = 0; i < bars.length; i++) {
      const midpoint = bars[i].time + 450
      expect(timeToLogical(midpoint, origin, 900, bars)).toBe(i)
      expect(logicalToTime(i, origin, 900, bars)).toBe(midpoint)
    }
  })
})
