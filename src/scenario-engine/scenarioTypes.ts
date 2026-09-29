import type { ChallengeType } from '@/types/game'
export type ScenarioMode = 'standard' | 'advanced'
export interface BaseScenario {
  id: string
  challengeType: ChallengeType
  mode: ScenarioMode
  variant: string
  estimatedDurationSeconds: number
  scoringProfile: string
  enabled: boolean
}
export interface ScenarioProgress {
  challengeType: ChallengeType
  seenScenarioIds: string[]
  completedScenarioIds: string[]
  lastScenarioId?: string
}
export function emptyScenarioProgress(): Record<ChallengeType, ScenarioProgress> {
  const make = (challengeType: ChallengeType): ScenarioProgress => ({ challengeType, seenScenarioIds: [], completedScenarioIds: [] })
  return { 'blind-market': make('blind-market'), 'market-maker': make('market-maker'), 'black-swan': make('black-swan'), 'cross-arbitrage': make('cross-arbitrage') }
}
export function metadata(challengeType: ChallengeType, variant: string, estimatedDurationSeconds = 90): Omit<BaseScenario, 'id'> {
  return { challengeType, variant, estimatedDurationSeconds, mode: 'standard', scoringProfile: `${challengeType}-v1`, enabled: true }
}
