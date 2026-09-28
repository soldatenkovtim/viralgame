import type { ChallengeType } from '@/types/game'
import type { RoomSeat, RoomView } from './roomTypes'
import type { DuelPlayerResult } from './types'

export interface SavedSeat { id: string; token: string; challengeType: ChallengeType }
const key = 'market-trials-room-seats-v1'
export function seats(): SavedSeat[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function saveSeat(seat: SavedSeat) {
  localStorage.setItem(key, JSON.stringify([...seats().filter(s => s.id !== seat.id), seat].slice(-100)))
}
export function seatToken(id: string) { return seats().find(s => s.id === id)?.token ?? '' }
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
async function request<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/duels${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Сервер дуэлей недоступен. Запусти приложение вместе с сервером.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Не удалось связаться с сервером дуэлей.')
  return data as T
}
export async function createRoom(challengeType: ChallengeType) {
  const token = newToken()
  const seat = await request<RoomSeat>('', token, { challengeType })
  saveSeat({ id: seat.room.id, token, challengeType })
  return seat.room
}
export function getRoom(id: string) { return request<RoomView>(`/${id}`, seatToken(id)) }
export async function joinRoom(id: string, challengeType: ChallengeType) {
  // Save before the request so a lost response never loses the claimed seat.
  const token = seatToken(id) || newToken()
  saveSeat({ id, token, challengeType })
  return request<RoomView>(`/${id}/join`, token, {})
}
export function startRoom(id: string) { return request<RoomView>(`/${id}/start`, seatToken(id), {}) }
const pendingKey = (id: string) => `market-trials-room-result-${id}`
export function pendingResult(id: string): DuelPlayerResult | null {
  try { return JSON.parse(localStorage.getItem(pendingKey(id)) || 'null') } catch { return null }
}
export function stashResult(id: string, result: DuelPlayerResult) { localStorage.setItem(pendingKey(id), JSON.stringify(result)) }
export async function finishRoom(room: RoomView, result: DuelPlayerResult) {
  const next = await request<RoomView>(`/${room.id}/finish`, seatToken(room.id), { result, scenarioId: room.scenarioId, seed: room.seed })
  localStorage.removeItem(pendingKey(room.id))
  return next
}
export function roomPath(id: string) { return `/duel/room/${id}` }
export function errorText(error: unknown) { return error instanceof Error ? error.message : 'Не удалось подключиться. Попробуй ещё раз.' }
