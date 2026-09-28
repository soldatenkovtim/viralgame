import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { expect, it, vi, afterEach } from 'vitest'
import { roomMiddleware, type RoomService } from './roomHttp'
import handler from '../api/duels'

const close = vi.fn()
function response() {
  let content = ''
  const res = { statusCode: 200, setHeader: vi.fn(), end: (value: string) => { content = value } } as unknown as ServerResponse
  return { res, body: () => JSON.parse(content) }
}
function request(path: string, body?: unknown, parsed = false) {
  const req = Readable.from(body && !parsed ? [JSON.stringify(body)] : []) as IncomingMessage & { body?: unknown }
  req.url = path; req.method = body ? 'POST' : 'GET'
  req.headers = { host: 'demo.vercel.app', origin: 'https://demo.vercel.app', authorization: `Bearer ${'h'.repeat(48)}` }
  if (parsed) req.body = body
  return req
}
afterEach(() => vi.unstubAllEnvs())
it.each([false, true])('awaits asynchronous API results with Vercel parsed body=%s', async parsed => {
  const create = vi.fn(async () => ({ room: { id: 'new-room' }, token: 'token' }))
  const service = { create, close } as unknown as RoomService
  const output = response()
  await roomMiddleware(service)(request('/api/duels', { challengeType: 'market-maker' }, parsed), output.res, vi.fn())
  expect(create).toHaveBeenCalledWith('market-maker', 'h'.repeat(48))
  expect(output.body().room.id).toBe('new-room')
})
it('preserves async authorization errors without leaking server details', async () => {
  const service = { get: vi.fn(async () => { throw new Error('postgres://secret') }), close } as unknown as RoomService
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const output = response()
  await roomMiddleware(service)(request(`/api/duels/${'a'.repeat(32)}`), output.res, vi.fn())
  expect(output.res.statusCode).toBe(500)
  expect(JSON.stringify(output.body())).not.toContain('secret')
  expect(log).toHaveBeenCalledWith('Duel API request failed')
  log.mockRestore()
})
it('rejects cross-origin writes before touching the database', async () => {
  const create = vi.fn(), output = response()
  const req = request('/api/duels', { challengeType: 'market-maker' })
  req.headers.origin = 'https://other.example'
  await roomMiddleware({ create, close } as unknown as RoomService)(req, output.res, vi.fn())
  expect(output.res.statusCode).toBe(403); expect(create).not.toHaveBeenCalled()
})
it('returns an actionable JSON response when the Vercel database is not connected', async () => {
  vi.stubEnv('DATABASE_URL', ''); vi.stubEnv('POSTGRES_URL', '')
  const output = response()
  await handler(request('/api/duels', { challengeType: 'market-maker' }), output.res)
  expect(output.res.statusCode).toBe(503)
  expect(output.body().error).toContain('База дуэлей ещё не подключена')
})
