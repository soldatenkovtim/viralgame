import { CHALLENGE_ORDER, challengeRoutes, type GameState } from '@/store/gameStore'

/** Continue the saved series, never imply that an unfinished round can be resumed. */
export function gameEntry(state: Pick<GameState, 'selectedMode' | 'completedChallenges' | 'advancedResults' | 'unlockedChallenges'>) {
  if (state.selectedMode === 'duel') return { to: '/#trials', label: 'Начать испытания' }
  const completed = state.selectedMode === 'advanced'
    ? [...new Set(state.advancedResults.map(result => result.challengeType))]
    : state.completedChallenges
  const next = CHALLENGE_ORDER.find(type => !completed.includes(type) &&
    (state.selectedMode === 'advanced' || state.unlockedChallenges.includes(type)))
  return {
    to: next ? challengeRoutes[next] : '/#trials',
    label: completed.length > 0 && next ? 'Продолжить испытания' : 'Начать испытания',
  }
}
