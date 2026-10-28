import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGE_ORDER, useGameStore, type GameState } from '@/store/gameStore'
import { ModeBoundary } from '@/modes/ModeSelector'
import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { nextTrial, preferredTrialMode, trialModeState } from './trialState'

// Render saved-state fixtures on the server without a browser storage shim.
vi.mock('@/store/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('@/store/gameStore')>()
  return { ...actual, useGameStore: Object.assign(
    (selector?: (state: GameState) => unknown) => selector ? selector(actual.useGameStore.getState()) : actual.useGameStore.getState(),
    actual.useGameStore,
  ) }
})

const initial = useGameStore.getInitialState()
const fresh = (): GameState => ({ ...initial })
afterEach(() => useGameStore.setState(fresh()))

describe('Trial card access and saved progress', () => {
  it.each(CHALLENGE_ORDER)('%s: duel is available without unlocking the standard series', challenge => {
    expect(trialModeState(fresh(), challenge, 'duel').available).toBe(true)
    expect(trialModeState(fresh(), challenge, 'standard').available).toBe(challenge === 'blind-market')
    expect(trialModeState(fresh(), challenge, 'advanced').available).toBe(false)
  })
  it('shows the exact predecessor, and chooses an available fallback', () => {
    expect(trialModeState(fresh(), 'black-swan', 'standard').condition).toBe('Пройдите «Маркет-мейкер» в стандартном режиме')
    expect(preferredTrialMode(fresh(), 'black-swan')).toBe('duel')
    expect(nextTrial(fresh())).toBe('blind-market')
    const state = { ...fresh(), completedChallenges: ['blind-market'], unlockedChallenges: ['blind-market', 'market-maker'] } as GameState
    expect(nextTrial(state)).toBe('market-maker')
  })
  it('keeps standard and advanced scores separate, including zero scores', () => {
    const state: GameState = { ...fresh(), advancedUnlocked: true, selectedMode: 'advanced',
      personalBests: { 'blind-market': 6400 }, advancedBests: { 'blind-market': 0 },
      advancedResults: [{ challengeType: 'blind-market', scenarioId: 'saved', score: 0, completedAt: '' }] }
    expect(trialModeState(state, 'blind-market', 'advanced')).toMatchObject({ available: true, completed: true, bestPoints: 0 })
    expect(trialModeState(state, 'blind-market', 'standard')).toMatchObject({ completed: false, bestPoints: 6400 })
    expect(trialModeState(state, 'blind-market', 'duel').bestPoints).toBeUndefined()
    expect(nextTrial(state)).toBe('market-maker')
    expect(preferredTrialMode(state, 'cross-arbitrage')).toBe('advanced')
  })
  it('does not infer a resumable round from a seen scenario or a historical best', () => {
    const state = fresh()
    state.personalBests = { 'blind-market': 5000 }
    state.scenarioProgress = { ...state.scenarioProgress, 'blind-market': {
      ...state.scenarioProgress['blind-market'], lastScenarioId: 'seen', seenScenarioIds: ['seen'],
    } }
    useGameStore.setState(state)
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ChallengeCard, { challenge: 'blind-market' })))
    expect(html).toContain('Начать испытание')
    expect(html).toContain('5 000')
    expect(html).not.toContain('Продолжить')
    expect(html).not.toContain('В процессе')
  })
})

function entry(state: GameState, challenge: string, requestedMode?: string) {
  useGameStore.setState(state)
  return renderToStaticMarkup(createElement(MemoryRouter, {
    initialEntries: [{ pathname: `/challenge/${challenge}`, state: { trialMode: requestedMode } }],
  }, createElement(Routes, null, createElement(Route, { path: '/challenge/:challenge',
    element: createElement(ModeBoundary, null, createElement('div', null, 'GAME_CONTENT')),
  }))))
}
describe('Trial card navigation', () => {
  it('starts the selected accessible challenge without repeating mode selection', () => {
    expect(entry(fresh(), 'blind-market', 'standard')).toContain('GAME_CONTENT')
    const state = { ...fresh(), selectedMode: 'advanced', advancedUnlocked: true } as GameState
    expect(entry(state, 'cross-arbitrage', 'advanced')).toContain('GAME_CONTENT')
  })
  it('preserves mode selection on ordinary direct links', () => {
    const html = entry(fresh(), 'blind-market')
    expect(html).not.toContain('GAME_CONTENT')
    expect(html).toContain('Выберите условия рынка')
  })
  it('does not grant access through stale or forged navigation state', () => {
    expect(entry(fresh(), 'market-maker', 'standard')).not.toContain('GAME_CONTENT')
    expect(entry(fresh(), 'blind-market', 'advanced')).not.toContain('GAME_CONTENT')
    expect(entry({ ...fresh(), selectedMode: 'advanced' }, 'blind-market', 'advanced')).not.toContain('GAME_CONTENT')
  })
})
