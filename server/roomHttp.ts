import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RoomView, RoomSeat } from '../src/duel/roomTypes.ts'
import { ApiError } from './roomDomain.ts'
type Awaitable<T> = T | Promise<T>
export interface RoomService {
  create(type: string, token: string): Awaitable<RoomSeat>
  get(id: string, token?: string): Awaitable<RoomView>
  act(id: string, token: string, action: string, body?: Record<string, unknown>): Awaitable<RoomView>
  close(): Awaitable<void>
}
export function roomMiddleware(service: RoomService) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0]
    if (!path.startsWith('/api/duels')) return next()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new ApiError(403, 'Запрос с другого сайта запрещён.')
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
      let body: Record<string, unknown> = {}
      if (req.method === 'POST') {
        const parsed = (req as IncomingMessage & { body?: unknown }).body
        let raw = ''
        if (parsed !== undefined) raw = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
        else for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 24000) throw new ApiError(413, 'Слишком большой запрос.') }
        if (Buffer.byteLength(raw) > 24000) throw new ApiError(413, 'Слишком большой запрос.')
        try { body = JSON.parse(raw || '{}'); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error() } catch { throw new ApiError(400, 'Некорректный запрос.') }
      }
      const match = /^\/api\/duels\/([A-Za-z0-9_-]{32})(?:\/(join|start|finish))?$/.exec(path)
      let result: unknown
      if (path === '/api/duels' && req.method === 'POST') result = await service.create(String(body.challengeType), token)
      else if (match && !match[2] && req.method === 'GET') result = await service.get(match[1], token)
      else if (match && match[2] && req.method === 'POST') result = await service.act(match[1], token, match[2], body)
      else throw new ApiError(404, 'Дуэль не найдена.')
      res.end(JSON.stringify(result))
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500
      if (!(error instanceof ApiError)) console.error('Duel API request failed')
      res.end(JSON.stringify({ error: error instanceof ApiError ? error.message : 'Сервер временно недоступен. Попробуй ещё раз.' }))
    }
  }
}
