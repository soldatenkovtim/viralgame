import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RoomView, PlayerStatus, RoomRole } from '../src/duel/roomTypes.ts'
import type { DuelPlayerResult } from '../src/duel/types.ts'
import { roomMarkets } from './catalog.ts'

type StoredRoom = Omit<RoomView, 'role' | 'results'> & {
  hostToken: string; guestToken?: string
  hostResult?: DuelPlayerResult; guestResult?: DuelPlayerResult
}
class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const secret = () => randomBytes(24).toString('base64url')
const same = (a: string, b?: string) => !!b && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const metrics: Record<keyof typeof roomMarkets, string[]> = {
  'blind-market': ['Прибыль, %', 'Макс. просадка, %', 'Макс. экспозиция, %', 'Время решения, с'],
  'market-maker': ['Прибыль', 'Доход от спреда', 'Переоценка позиции', 'Расходы на хедж', 'Макс. позиция', 'Время сверх лимита, с'],
  'black-swan': ['Прибыль, %', 'Макс. просадка, %', 'Макс. экспозиция, %', 'Цена выхода', 'Время решения, с'],
  'cross-arbitrage': ['Чистая прибыль, %', 'Время решения, с', 'Лучший чистый доход, %', 'Сделок'],
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12
function validResult(value: unknown, type: keyof typeof roomMarkets): value is DuelPlayerResult {
  if (!value || typeof value !== 'object') return false
  const r = value as DuelPlayerResult
  const count = { 'blind-market': 3, 'market-maker': 0, 'black-swan': 3, 'cross-arbitrage': 5 }[type]
  return finite(r.score) && r.score >= 0 && r.score <= 100 && !!r.metrics && typeof r.metrics === 'object'
    && Object.keys(r.metrics).length === metrics[type].length
    && metrics[type].every(k => finite(r.metrics[k]) || (k === 'Цена выхода' && r.metrics[k] === '—'))
    && Array.isArray(r.decisions) && (type === 'black-swan' ? r.decisions.length >= 1 && r.decisions.length <= 3 : r.decisions.length === count)
    && r.decisions.every(d => d && typeof d.label === 'string' && d.label.length <= 240
      && (d.candleIndex === undefined || (Number.isInteger(d.candleIndex) && d.candleIndex >= 0 && d.candleIndex < 100000))
      && (d.price === undefined || (finite(d.price) && d.price > 0))
      && (d.exposure === undefined || (finite(d.exposure) && Math.abs(d.exposure) <= 2)))
}

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
  const roleFor = (room: StoredRoom, token: string): RoomRole | null => same(token, room.hostToken) ? 'host' : same(token, room.guestToken) ? 'guest' : null
  const view = (room: StoredRoom, token: string): RoomView => {
    const role = roleFor(room, token)
    return { id: room.id, challengeType: room.challengeType, scenarioId: room.scenarioId, seed: room.seed,
      createdAt: room.createdAt, role, host: room.host, guest: room.guest,
      ...(role && room.hostResult && room.guestResult ? { results: { host: room.hostResult, guest: room.guestResult } } : {}) }
  }
  return {
    close: () => db.close(),
    create(type: string, token: string) {
      if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) throw new ApiError(400, 'Неверный ключ игрока.')
      if (!Object.hasOwn(roomMarkets, type)) throw new ApiError(400, 'Неизвестное испытание.')
      const challengeType = type as keyof typeof roomMarkets
      const choices = roomMarkets[challengeType]
      const scenario = choices[randomInt(choices.length)]
      const room: StoredRoom = { id: secret(), challengeType, scenarioId: scenario.id, seed: scenario.seed,
        createdAt: new Date().toISOString(), hostToken: token, host: 'ready', guest: 'invited' }
      save(room)
      return { room: view(room, token), token }
    },
    get(id: string, token = '') { return view(read(id), token) },
    act(id: string, token: string, action: string, body: Record<string, unknown> = {}) {
      // Synchronous read/update is atomic within this single server process.
      const room = read(id)
      let role = roleFor(room, token)
      if (action === 'join') {
        if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) throw new ApiError(400, 'Неверный ключ игрока.')
        if (!role) {
          if (room.guestToken) throw new ApiError(409, 'В этой дуэли уже два игрока. Открой её в браузере, в котором присоединился, или создай новую.')
          room.guestToken = token; room.guest = 'ready'; role = 'guest'
        }
      }
      if (!role) throw new ApiError(403, 'Это место принадлежит другому игроку.')
      if (action === 'start') {
        if (room[role] !== 'finished') room[role] = 'playing'
      } else if (action === 'finish') {
        if (body.scenarioId !== room.scenarioId || body.seed !== room.seed || !validResult(body.result, room.challengeType)) throw new ApiError(400, 'Результат не соответствует рынку дуэли.')
        if (room[role] === 'ready') throw new ApiError(409, 'Сначала начни испытание.')
        if (room[role] !== 'finished') {
          room[`${role}Result`] = body.result
          room[role] = 'finished' satisfies PlayerStatus
        }
      } else if (action !== 'join') throw new ApiError(404, 'Неизвестное действие.')
      save(room)
      return view(room, token)
    },
  }
}
export type RoomService = ReturnType<typeof createRoomService>
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
        let raw = ''
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 24000) throw new ApiError(413, 'Слишком большой запрос.') }
        try { body = JSON.parse(raw || '{}'); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error() } catch { throw new ApiError(400, 'Некорректный запрос.') }
      }
      const match = /^\/api\/duels\/([A-Za-z0-9_-]{32})(?:\/(join|start|finish))?$/.exec(path)
      let result: unknown
      if (path === '/api/duels' && req.method === 'POST') result = service.create(String(body.challengeType), token)
      else if (match && !match[2] && req.method === 'GET') result = service.get(match[1], token)
      else if (match && match[2] && req.method === 'POST') result = service.act(match[1], token, match[2], body)
      else throw new ApiError(404, 'Дуэль не найдена.')
      res.end(JSON.stringify(result))
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500
      if (!(error instanceof ApiError)) console.error(error)
      res.end(JSON.stringify({ error: error instanceof ApiError ? error.message : 'Сервер временно недоступен. Попробуй ещё раз.' }))
    }
  }
}
