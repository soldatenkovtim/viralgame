import { expect, it } from 'vitest'
import { mergeRoom } from './roomState'
import type { RoomView } from './roomTypes'
const room: RoomView = { id: 'room', challengeType: 'market-maker', scenarioId: 'mm_informed_rally', seed: 401173,
  createdAt: '2026-01-01', role: 'host', host: 'ready', guest: 'invited' }
it('does not unmount a running game when an earlier polling response arrives late', () => {
  expect(mergeRoom({ ...room, host: 'playing', guest: 'ready' }, room)).toMatchObject({ host: 'playing', guest: 'ready' })
})
it('retains the seat and comparison if a pre-join or pre-finish response arrives late', () => {
  const results = { host: { score: 50, metrics: {}, decisions: [] }, guest: { score: 60, metrics: {}, decisions: [] } }
  expect(mergeRoom({ ...room, host: 'finished', guest: 'finished', results }, { ...room, role: null })).toMatchObject({ host: 'finished', guest: 'finished', role: 'host', results })
})
