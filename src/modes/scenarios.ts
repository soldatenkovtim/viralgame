import { blindMarketScenarios, pickBlindScenario } from '@/data/blindMarketScenarios'
import { marketMakerScenarios, pickMarketMakerScenario } from '@/data/marketMakerScenarios'
import { crossArbitrageSessions, pickCrossArbitrageSession } from '@/data/crossArbitrageScenarios'
import { marketShockScenarios, pickMarketShockScenario } from '@/games/market-shock/scenarios'
import { advancedBlindScenarios, advancedMakerScenarios, advancedShockScenarios, advancedArbitrageSessions } from '@/data/advanced/scenarios'
import type { ChallengeType } from '@/types/game'
export const scenarioCatalog = {
  'blind-market': [...blindMarketScenarios, ...advancedBlindScenarios],
  'market-maker': [...marketMakerScenarios, ...advancedMakerScenarios],
  'black-swan': [...marketShockScenarios, ...advancedShockScenarios],
  'cross-arbitrage': [...crossArbitrageSessions, ...advancedArbitrageSessions],
}
export function selectScenario<T extends ChallengeType>(type: T, advanced: boolean, attempt: number, id?: string | null): (typeof scenarioCatalog)[T][number] {
  const pool = scenarioCatalog[type]
  if (id) {
    const found = pool.find(s => s.id === id && (s.mode === 'advanced') === advanced)
    if (found) return found
  }
  if (advanced) {
    const candidates = pool.filter(s => s.mode === 'advanced')
    return candidates[attempt % candidates.length]
  }
  const picks = { 'blind-market': pickBlindScenario, 'market-maker': pickMarketMakerScenario,
    'black-swan': pickMarketShockScenario, 'cross-arbitrage': pickCrossArbitrageSession }
  return picks[type](attempt) as (typeof scenarioCatalog)[T][number]
}
