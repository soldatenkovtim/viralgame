import type { ChallengeType } from '@/types/game'
/** Только данные для сравнения: без свечей, replay и пользовательской разметки. */
export interface DuelDecision { label: string; candleIndex?: number; price?: number; exposure?: number }
export interface DuelPlayerResult {
  score: number
  metrics: Record<string, number | string>
  decisions: DuelDecision[]
}
export interface DuelPayload {
  version: 1
  challengeType: ChallengeType
  mode: 'duel'
  seed: number
  scenarioId: string
  challengerResult: DuelPlayerResult
  createdAt: string
}
export interface DuelResult {
  id: string
  challengeType: ChallengeType
  scenarioId: string
  seed: number
  challengerResult: DuelPlayerResult
  opponentResult: DuelPlayerResult
  completedAt: string
}
