import type { ChallengeType } from '../types/game'
import type { DuelPlayerResult } from './types'

export type RoomRole = 'host' | 'guest'
export type PlayerStatus = 'invited' | 'ready' | 'playing' | 'finished'
export interface RoomView {
  id: string
  challengeType: ChallengeType
  scenarioId: string
  seed: number
  createdAt: string
  role: RoomRole | null
  host: PlayerStatus
  guest: PlayerStatus
  results?: { host: DuelPlayerResult; guest: DuelPlayerResult }
}
export interface RoomSeat { room: RoomView; token: string }
