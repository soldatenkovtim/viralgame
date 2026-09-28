import type { IncomingMessage, ServerResponse } from 'node:http'
import { attachDatabasePool } from '@vercel/functions'
import { createPostgresRoomService, createRoomPool } from '../server/postgres.ts'
import { roomMiddleware } from '../server/roomHttp.ts'

let middleware: ReturnType<typeof roomMiddleware> | undefined
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) {
    res.statusCode = 503
    res.end(JSON.stringify({ error: 'База дуэлей ещё не подключена. Владелец сайта должен подключить базу в Vercel и обновить деплой.' }))
    return
  }
  if (!middleware) {
    const pool = createRoomPool(url)
    attachDatabasePool(pool)
    middleware = roomMiddleware(createPostgresRoomService(pool))
  }
  // Vercel rewrite carries the room suffix; never permit arbitrary upstream URLs.
  const query = new URL(req.url ?? '/', 'http://localhost').searchParams
  const rewritten = (req as IncomingMessage & { query?: Record<string, unknown> }).query?.roomPath
  const suffix = query.get('roomPath') ?? (typeof rewritten === 'string' ? rewritten : null)
  if (suffix !== null) req.url = `/api/duels${suffix ? `/${suffix}` : ''}`
  await middleware(req, res, () => { res.statusCode = 404; res.end(JSON.stringify({ error: 'Неизвестный адрес дуэли.' })) })
}
