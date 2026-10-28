import { describe, expect, it } from 'vitest'
import { gameEntry } from './gameEntry'
import { CHALLENGE_ORDER, type GameState } from '@/store/gameStore'

const fresh: Pick<GameState, 'selectedMode' | 'completedChallenges' | 'advancedResults' | 'unlockedChallenges'> = {
  selectedMode: 'standard', completedChallenges: [], advancedResults: [], unlockedChallenges: ['blind-market'],
}

describe('entry into the existing series', () => {
  it('starts at the first available challenge', () => {
    expect(gameEntry(fresh)).toEqual({ to: '/challenge/blind-market', label: 'Начать испытания' })
  })
  it('continues at the next unlocked challenge in the real series order', () => {
    expect(gameEntry({ ...fresh, completedChallenges: ['blind-market'], unlockedChallenges: ['blind-market', 'market-maker'] }))
      .toEqual({ to: '/challenge/market-maker', label: 'Продолжить испытания' })
  })
  it('does not imply that a finished series has an unfinished round', () => {
    expect(gameEntry({ ...fresh, completedChallenges: CHALLENGE_ORDER, unlockedChallenges: CHALLENGE_ORDER }))
      .toEqual({ to: '/#trials', label: 'Начать испытания' })
  })
  it('uses advanced progress independently of the standard series', () => {
    expect(gameEntry({ ...fresh, selectedMode: 'advanced', completedChallenges: CHALLENGE_ORDER,
      advancedResults: [{ challengeType: 'blind-market', scenarioId: 'test', score: 50, completedAt: '2026-01-01' }] }))
      .toEqual({ to: '/challenge/market-maker', label: 'Продолжить испытания' })
  })
  it('lets duel players choose a market without suggesting series progress', () => {
    expect(gameEntry({ ...fresh, selectedMode: 'duel', completedChallenges: ['blind-market'] }))
      .toEqual({ to: '/#trials', label: 'Начать испытания' })
  })
})
