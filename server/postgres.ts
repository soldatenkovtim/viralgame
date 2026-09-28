import { Pool } from 'pg'
import { ApiError, newRoom, roomView, updateRoom, type StoredRoom } from './roomDomain.ts'
import type { RoomService } from './roomHttp.ts'

export function createPostgresRoomService(pool: Pool): RoomService {
  let initialized: Promise<void> | undefined
  function initialize() {
    if (!initialized) initialized = (async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Concurrent cold starts must not race during first-time schema creation.
        await client.query('SELECT pg_advisory_xact_lock(730114, 3)')
        await client.query('CREATE TABLE IF NOT EXISTS market_trials_rooms (id TEXT PRIMARY KEY, data JSONB NOT NULL)')
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error }
      finally { client.release() }
    })().catch(error => { initialized = undefined; throw error })
    return initialized
  }
  return {
    close: () => pool.end(),
    async create(type, token) {
      const room = newRoom(type, token)
      await initialize()
      await pool.query('INSERT INTO market_trials_rooms (id, data) VALUES ($1, $2::jsonb)', [room.id, JSON.stringify(room)])
      return { room: roomView(room, token), token }
    },
    async get(id, token = '') {
      await initialize()
      const result = await pool.query<{ data: StoredRoom }>('SELECT data FROM market_trials_rooms WHERE id = $1', [id])
      if (!result.rows[0]) throw new ApiError(404, 'Дуэль не найдена. Проверь ссылку или создай новую.')
      return roomView(result.rows[0].data, token)
    },
    async act(id, token, action, body = {}) {
      await initialize()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // One row lock serializes simultaneous joins and finishes across all instances.
        const result = await client.query<{ data: StoredRoom }>('SELECT data FROM market_trials_rooms WHERE id = $1 FOR UPDATE', [id])
        if (!result.rows[0]) throw new ApiError(404, 'Дуэль не найдена. Проверь ссылку или создай новую.')
        const room = updateRoom(result.rows[0].data, token, action, body)
        await client.query('UPDATE market_trials_rooms SET data = $2::jsonb WHERE id = $1', [id, JSON.stringify(room)])
        await client.query('COMMIT')
        return roomView(room, token)
      } catch (error) { await client.query('ROLLBACK'); throw error }
      finally { client.release() }
    },
  }
}
export function createRoomPool(connectionString: string) {
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 8000,
    statement_timeout: 10000, idle_in_transaction_session_timeout: 10000 })
  pool.on('error', () => console.error('Duel database connection interrupted'))
  return pool
}
