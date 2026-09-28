import type { RoomService } from './roomHttp.js'
export async function configuredRooms(): Promise<RoomService> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (url) {
    const { createPostgresRoomService, createRoomPool } = await import('./postgres.js')
    return createPostgresRoomService(createRoomPool(url))
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL is required on Vercel')
  const { createRoomService } = await import('./rooms.js')
  return createRoomService(process.env.DUEL_DB_PATH || '.data/duels.sqlite')
}
