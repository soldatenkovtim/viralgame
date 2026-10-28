import { expect, it } from 'vitest'
import { buildLeaderboard } from './leaderboard'

it('does not fill an empty leaderboard with synthetic participants', () => {
  expect(buildLeaderboard()).toEqual([])
  expect(buildLeaderboard(null)).toEqual([])
})

it('preserves a real local score without inventing a global rank', () => {
  const player = { nickname: 'Игрок', score: 7345, archetype: 'Арбитражёр' }
  expect(buildLeaderboard(player)).toEqual([{ ...player, rank: null, isCurrentUser: true }])
})
