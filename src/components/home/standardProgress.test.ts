import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGE_ORDER, challengeRoutes, useGameStore, type GameState } from '@/store/gameStore'
import { ProgressSection } from './ProgressSection'
import { standardProgress } from './standardProgress'

vi.mock('@/store/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('@/store/gameStore')>()
  return { ...actual, useGameStore: Object.assign(
    (selector?: (state: GameState) => unknown) => selector ? selector(actual.useGameStore.getState()) : actual.useGameStore.getState(),
    actual.useGameStore,
  ) }
})
const initial = useGameStore.getInitialState()
afterEach(() => useGameStore.setState(initial))
const fixture = (count: number): GameState => ({ ...initial,
  selectedMode: 'duel',
  completedChallenges: CHALLENGE_ORDER.slice(0, count),
  unlockedChallenges: CHALLENGE_ORDER.slice(0, Math.min(count + 1, 4)),
  advancedUnlocked: count === 4,
})

describe('Home standard-series progress', () => {
  it.each([0, 1, 2, 3, 4])('%i/4: real count, segments and next action', count => {
    const state = fixture(count)
    const progress = standardProgress(state)
    const action = count === 4 ? 'Посмотреть результаты' : count === 0 ? 'Начать испытание' : 'Продолжить'
    const to = count === 4 ? '/profile' : challengeRoutes[CHALLENGE_ORDER[count]]
    expect(progress).toMatchObject({ count, total: 4, action, to, complete: count === 4 })
    useGameStore.setState(state)
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ProgressSection)))
    expect(html).toContain(`aria-valuenow="${count}"`)
    expect(html.match(/data-complete="true"/g) ?? []).toHaveLength(count)
    expect(html).toContain(`href="${to}"`)
    expect(html).toContain(action)
    expect(html).toContain('href="/profile"')
    expect(html).toContain('href="/play"')
    expect(html).not.toContain('Не пройдено')
    expect(html).not.toContain('Рейтинг участников')
    expect(html.includes('Продвинутый режим открыт.')).toBe(count === 4)
  })
  it('uses actual unlocks instead of assuming the next numeric position', () => {
    const state: GameState = { ...fixture(1), unlockedChallenges: ['blind-market', 'black-swan'] }
    expect(standardProgress(state).next).toBe('black-swan')
    expect(standardProgress(state).to).toBe('/challenge/black-swan')
  })
  it('does not offer a locked standard trial when there is no available next step', () => {
    const state: GameState = { ...fixture(1), unlockedChallenges: ['blind-market'] }
    expect(standardProgress(state)).toMatchObject({ next: undefined, to: '/#trials', action: 'Выбрать испытание' })
  })
  it('duels, advanced results, best scores and seen scenarios do not complete the standard series', () => {
    const result = { score: 80, metrics: {}, decisions: [] }
    const state: GameState = { ...fixture(0), selectedMode: 'advanced', advancedUnlocked: true,
      advancedResults: CHALLENGE_ORDER.map(challengeType => ({ challengeType, scenarioId: 'test', score: 80, completedAt: '' })),
      personalBests: { 'blind-market': 8000 },
    }
    useGameStore.setState(state)
    useGameStore.getState().markScenarioStarted('blind-market', 'seen', 'standard')
    useGameStore.getState().saveDuel({ id: 'test', challengeType: 'blind-market', scenarioId: 'test', seed: 1,
      challengerResult: result, opponentResult: result, completedAt: '' })
    expect(standardProgress(useGameStore.getState())).toMatchObject({ count: 0, next: 'blind-market', action: 'Начать испытание' })
  })
  it('series restart resets the visible count despite saved historical results', () => {
    useGameStore.setState({ ...fixture(4), personalBests: { 'blind-market': 8000 } })
    useGameStore.getState().restartSeries()
    expect(standardProgress(useGameStore.getState())).toMatchObject({ count: 0, to: '/challenge/blind-market' })
  })
  it('counts each challenge once', () => {
    expect(standardProgress({ ...fixture(1), completedChallenges: ['blind-market', 'blind-market'] }).count).toBe(1)
  })
})
