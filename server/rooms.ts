import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ApiError, newRoom, roomView, updateRoom, type StoredRoom } from './roomDomain.ts'
export { roomMiddleware } from './roomHttp.ts'
export type { RoomService } from './roomHttp.ts'

export function createRoomService(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL);')
  const save = (room: StoredRoom) => db.prepare('INSERT OR REPLACE INTO rooms (id, data) VALUES (?, ?)').run(room.id, JSON.stringify(room))
  const read = (id: string): StoredRoom => {
    const row = db.prepare('SELECT data FROM rooms WHERE id = ?').get(id)
    if (!row) throw new ApiError(404, 'Дуэль не найдена. Проверь ссылку или создай новую.')
    return JSON.parse(row.data as string)
  }
  return {
    close: () => db.close(),
    create(type: string, token: string) {
      const room = newRoom(type, token)
      save(room)
      return { room: roomView(room, token), token }
    },
    get(id: string, token = '') { return roomView(read(id), token) },
    act(id: string, token: string, action: string, body: Record<string, unknown> = {}) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const room = updateRoom(read(id), token, action, body)
        save(room)
        db.exec('COMMIT')
        return roomView(room, token)
      } catch (error) { db.exec('ROLLBACK'); throw error }
    },
  }
}
