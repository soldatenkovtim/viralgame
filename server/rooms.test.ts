import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRoomService } from './rooms'
import { roomMarkets } from './catalog'
import { scenarioCatalog } from '../src/modes/scenarios'
import type { DuelPlayerResult } from '../src/duel/types'

const host = 'h'.repeat(48), guest = 'g'.repeat(48), third = 'x'.repeat(48)
const result: DuelPlayerResult = { score: 50, metrics: {
  'Прибыль': 10, 'Доход от спреда': 12, 'Переоценка позиции': -1,
  'Расходы на хедж': 1, 'Макс. позиция': 20, 'Время сверх лимита, с': 0,
}, decisions: [] }
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()) })
function setup() {
  const service = createRoomService(':memory:'); cleanups.push(() => service.close())
  const { room } = service.create('market-maker', host)
  return { service, room, body: { scenarioId: room.scenarioId, seed: room.seed, result } }
}
describe('Shared duel rooms', () => {
  it('uses the exact supported markets and seeds for all four challenges', () => {
    for (const type of Object.keys(roomMarkets) as (keyof typeof roomMarkets)[]) {
      for (const market of roomMarkets[type]) expect(scenarioCatalog[type].find(s => s.id === market.id)?.seed).toBe(market.seed)
    }
  })
  it('lets the host play before a guest joins, hiding results until both finish', () => {
    const { service, room, body } = setup()
    service.act(room.id, host, 'start')
    service.act(room.id, host, 'finish', body)
    expect(service.get(room.id, host).results).toBeUndefined()
    expect(JSON.stringify(service.get(room.id))).not.toContain('metrics')
    const joined = service.act(room.id, guest, 'join')
    expect(joined.role).toBe('guest'); expect(joined.seed).toBe(room.seed)
    service.act(room.id, guest, 'start')
    expect(service.get(room.id, guest).results).toBeUndefined()
    service.act(room.id, guest, 'finish', { ...body, result: { ...result, score: 60 } })
    expect(service.get(room.id, host).results?.guest.score).toBe(60)
    expect(service.get(room.id, guest).results?.host.score).toBe(50)
    expect(service.get(room.id, third).results).toBeUndefined()
  })
  it('allows concurrent independent play and immutable, idempotent submission', () => {
    const { service, room, body } = setup()
    service.act(room.id, guest, 'join')
    service.act(room.id, host, 'start'); service.act(room.id, guest, 'start')
    expect(service.get(room.id, host)).toMatchObject({ host: 'playing', guest: 'playing' })
    service.act(room.id, guest, 'finish', body)
    expect(service.get(room.id, host).results).toBeUndefined()
    service.act(room.id, host, 'finish', body)
    service.act(room.id, host, 'finish', { ...body, result: { ...result, score: 99 } })
    expect(service.get(room.id, host).results?.host.score).toBe(50)
    expect(service.act(room.id, host, 'start').host).toBe('finished')
  })
  it('reserves exactly two places and protects participant actions', () => {
    const { service, room, body } = setup()
    service.act(room.id, guest, 'join')
    expect(service.act(room.id, guest, 'join').role).toBe('guest')
    expect(() => service.act(room.id, third, 'join')).toThrow('уже два игрока')
    expect(() => service.act(room.id, third, 'start')).toThrow('другому игроку')
    expect(() => service.act(room.id, third, 'finish', body)).toThrow('другому игроку')
    expect(() => service.act(room.id, host, 'finish', body)).toThrow('Сначала')
    expect(JSON.stringify(service.get(room.id, host))).not.toContain(host)
    expect(JSON.stringify(service.get(room.id, guest))).not.toContain(guest)
  })
  it('rejects a different market and malformed results', () => {
    const { service, room, body } = setup(); service.act(room.id, host, 'start')
    for (const bad of [{ ...body, seed: 1 }, { ...body, scenarioId: 'bad' }, { ...body, result: {} }, { ...body, result: { ...result, score: Infinity } }]) {
      expect(() => service.act(room.id, host, 'finish', bad)).toThrow('не соответствует')
    }
    expect(() => service.create('__proto__', host)).toThrow('Неизвестное')
  })
  it('persists room ownership and results across server restarts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'duel-test-')); cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    const file = join(dir, 'rooms.sqlite')
    const first = createRoomService(file)
    const { room } = first.create('market-maker', host)
    first.act(room.id, host, 'start'); first.act(room.id, host, 'finish', { scenarioId: room.scenarioId, seed: room.seed, result })
    first.close()
    const second = createRoomService(file); cleanups.push(() => second.close())
    expect(second.get(room.id, host)).toMatchObject({ role: 'host', host: 'finished' })
    second.act(room.id, guest, 'join'); second.act(room.id, guest, 'start')
    second.act(room.id, guest, 'finish', { scenarioId: room.scenarioId, seed: room.seed, result })
    expect(second.get(room.id, host).results?.host).toEqual(result)
  })
})
