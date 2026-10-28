import { CHALLENGE_ORDER, challengeTitles, type GameState } from '@/store/gameStore'
import type { GameMode } from '@/modes/config'
import type { ChallengeType } from '@/types/game'

export const trialModes: GameMode[] = ['standard', 'advanced', 'duel']
export const trialModeLabels: Record<GameMode, string> = {
  standard: 'Стандартный', advanced: 'Продвинутый', duel: 'Дуэль',
}

const prerequisiteNames: Record<ChallengeType, string> = {
  'blind-market': 'Слепого рынка', 'market-maker': 'Маркет-мейкера',
  'black-swan': 'Рыночного шока', 'cross-arbitrage': 'Кросс-арбитража',
}

/** Presentation of the existing entry rules; does not grant access or persist progress. */
export function trialModeState(state: GameState, challenge: ChallengeType, mode: GameMode) {
  const available = mode === 'duel' || (mode === 'advanced'
    ? state.advancedUnlocked : state.unlockedChallenges.includes(challenge))
  const previous = CHALLENGE_ORDER[CHALLENGE_ORDER.indexOf(challenge) - 1]
  const condition = mode === 'advanced' ? 'Пройдите всю серию в стандартном режиме'
    : previous ? `Пройдите «${challengeTitles[previous]}» в стандартном режиме` : 'Начните с первого испытания'
  const shortCondition = mode === 'advanced' ? 'После всей серии'
    : previous ? `После «${prerequisiteNames[previous]}»` : 'Закрыт'
  const completed = mode === 'duel' ? state.duelHistory.some(result => result.challengeType === challenge)
    : mode === 'advanced' ? state.advancedResults.some(result => result.challengeType === challenge)
      : state.completedChallenges.includes(challenge)
  const bestPoints = mode === 'duel' ? undefined
    : (mode === 'advanced' ? state.advancedBests : state.personalBests)[challenge]
  return { available, condition, shortCondition, completed, bestPoints }
}

export function preferredTrialMode(state: GameState, challenge: ChallengeType): GameMode {
  if (trialModeState(state, challenge, state.selectedMode).available) return state.selectedMode
  return state.unlockedChallenges.includes(challenge) ? 'standard' : 'duel'
}

export function nextTrial(state: GameState) {
  return CHALLENGE_ORDER.find(challenge => {
    const mode = trialModeState(state, challenge, state.selectedMode)
    return mode.available && !mode.completed
  }) ?? CHALLENGE_ORDER.find(challenge => trialModeState(state, challenge, state.selectedMode).available)
}
