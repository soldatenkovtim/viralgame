import { legacyMarketShockScenarios } from '@/games/market-shock/legacyScenarios'
import { legacyBlindMarketScenarios } from '@/data/legacyBlindMarketScenarios'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import { crossArbitrageSessions } from '@/data/crossArbitrageScenarios'
import { marketShockScenarios } from '@/games/market-shock/scenarios'
import { advancedBlindScenarios, advancedMakerScenarios, advancedShockScenarios, advancedArbitrageSessions } from '@/data/advanced/scenarios'
import type { ChallengeType } from '@/types/game'
import type { ScenarioMode } from '@/scenario-engine/scenarioTypes'
const archivedAdvancedBlind = legacyBlindMarketScenarios.map((s, i) => ({ ...s, id: `advanced-historical-blind-${i + 1}`, mode: 'advanced' as const, checkpoints: s.checkpoints.map(c => c - 1) }))
const archivedAdvancedShock = legacyMarketShockScenarios.map((s, i) => ({ ...s, id: `advanced-historical-shock-${i + 1}`, mode: 'advanced' as const, scoringProfile: 'black-swan-advanced-v1' }))
export const scenarioCatalog = {
  'blind-market': [...blindMarketScenarios, ...legacyBlindMarketScenarios, ...advancedBlindScenarios, ...archivedAdvancedBlind],
  'market-maker': [...marketMakerScenarios, ...advancedMakerScenarios],
  'black-swan': [...marketShockScenarios, ...legacyMarketShockScenarios, ...advancedShockScenarios, ...archivedAdvancedShock],
  'cross-arbitrage': [...crossArbitrageSessions, ...advancedArbitrageSessions],
}
export function scenarioById<T extends ChallengeType>(type: T, id: string): (typeof scenarioCatalog)[T][number] {
  const found = scenarioCatalog[type].find(s => s.id === id)
  if (!found) throw new Error(`Unknown scenario: ${type}/${id}`)
  return found
}
export function scenarioPool<T extends ChallengeType>(type: T, mode: ScenarioMode): (typeof scenarioCatalog)[T][number][] {
  return scenarioCatalog[type].filter(s => s.enabled && s.mode === mode)
}
/** The numeric/boolean overload is retained for existing callers; normal play supplies history. */
export function selectScenario<T extends ChallengeType>(type: T, mode: ScenarioMode | boolean, seen: readonly string[] | number, id?: string | null, lastId?: string): (typeof scenarioCatalog)[T][number] {
  const resolvedMode = typeof mode === 'boolean' ? mode ? 'advanced' : 'standard' : mode
  if (id) {
    const found = scenarioById(type, id)
    if (found.mode !== resolvedMode) throw new Error('Scenario mode mismatch')
    return found
  }
  const pool = scenarioPool(type, resolvedMode)
  const history = typeof seen === 'number' ? [] : seen
  const unseen = pool.filter(s => !history.includes(s.id))
  const alternatives = pool.filter(s => s.id !== lastId)
  const candidates = unseen.length ? unseen : alternatives.length ? alternatives : pool
  if (!candidates.length) throw new Error(`Empty scenario pool: ${type}/${resolvedMode}`)
  return candidates[Math.floor(Math.random() * candidates.length)]
}
