export interface LeaderboardEntry {
  /** A global position is unavailable until a shared leaderboard is connected. */
  rank: number | null
  nickname: string
  score: number
  archetype: string
  isCurrentUser?: boolean
}

export interface CurrentUser {
  nickname: string
  score: number
  archetype: string
}

/** Only persisted player results are available; never synthesize other participants. */
export function buildLeaderboard(currentUser?: CurrentUser | null): LeaderboardEntry[] {
  return currentUser ? [{ ...currentUser, rank: null, isCurrentUser: true }] : []
}
