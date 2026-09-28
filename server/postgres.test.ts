import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { createPostgresRoomService } from './postgres'
import { newRoom, type StoredRoom } from './roomDomain'

const host = 'h'.repeat(48), guest = 'g'.repeat(48)
function database(room?: StoredRoom) {
  let stored = room ? structuredClone(room) : undefined
  const release = vi.fn()
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('SELECT data')) return { rows: stored ? [{ data: structuredClone(stored) }] : [] }
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE')) stored = JSON.parse(args[1] as string)
    return { rows: [] }
  })
  const connect = vi.fn(async () => ({ query, release }))
  const pool = { connect, query, end: vi.fn() } as unknown as Pool
  return { service: createPostgresRoomService(pool), query, release }
}
describe('Postgres room persistence', () => {
  it('initializes once, parameterizes room data and returns no participant keys', async () => {
    const { service, query } = database()
    const { room } = await service.create('market-maker', host)
    const view = await service.get(room.id, host)
    expect(view.role).toBe('host')
    expect(JSON.stringify(view)).not.toContain(host)
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('CREATE TABLE'))).toHaveLength(1)
    expect(query.mock.calls.find(([sql]) => sql.startsWith('INSERT'))?.[1]?.[0]).toBe(room.id)
  })
  it('locks the row until a participant update is committed', async () => {
    const room = newRoom('market-maker', host)
    const { service, query, release } = database(room)
    await service.get(room.id)
    query.mockClear(); release.mockClear()
    expect((await service.act(room.id, guest, 'join')).role).toBe('guest')
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', 'SELECT data FROM market_trials_rooms WHERE id = $1 FOR UPDATE',
      'UPDATE market_trials_rooms SET data = $2::jsonb WHERE id = $1', 'COMMIT',
    ])
    expect(release).toHaveBeenCalledOnce()
  })
  it('rolls back an unauthorized update and releases its connection', async () => {
    const room = newRoom('market-maker', host)
    const { service, query, release } = database(room)
    await service.get(room.id); query.mockClear(); release.mockClear()
    await expect(service.act(room.id, guest, 'finish')).rejects.toThrow('другому игроку')
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'SELECT data FROM market_trials_rooms WHERE id = $1 FOR UPDATE', 'ROLLBACK'])
    expect(release).toHaveBeenCalledOnce()
  })
  it('retries schema initialization after a temporary database failure', async () => {
    const { service, query } = database()
    query.mockRejectedValueOnce(new Error('temporary'))
    await expect(service.create('market-maker', host)).rejects.toThrow('temporary')
    await expect(service.create('market-maker', host)).resolves.toHaveProperty('room')
  })
})
