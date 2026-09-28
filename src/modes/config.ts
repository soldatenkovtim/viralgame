import type { ChallengeType } from '@/types/game'
export type GameMode = 'standard' | 'advanced' | 'duel'
export interface ChallengeContext { mode: GameMode; seed: number }
export interface ScenarioDifficultyConfig {
  mode: 'standard' | 'advanced'
  timerSeconds: number
  hintsEnabled: boolean
  complexity: number
}
export function difficultyFor(type: ChallengeType, advanced: boolean): ScenarioDifficultyConfig {
  return { mode: advanced ? 'advanced' : 'standard', hintsEnabled: !advanced,
    complexity: advanced ? 2 : 1,
    timerSeconds: type === 'market-maker' ? 60 : type === 'cross-arbitrage' ? (advanced ? 9 : 15) : advanced ? 13 : 20 }
}
/** P1: независимое исполнение на общем детерминированном рынке. */
export interface DuelExecutionPolicy { kind: 'independent'; scenarioVersion: 1 }
export const duelExecutionPolicy: DuelExecutionPolicy = { kind: 'independent', scenarioVersion: 1 }
