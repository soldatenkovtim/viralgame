import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { challengeTitles, useGameStore, type ResultPayload } from '@/store/gameStore'
import { DuelGame } from './DuelGame'
import { DuelComparison } from './DuelComparison'
import { mergeRoom } from './roomState'
import { summarizeResult } from './createDuel'
import { errorText, finishRoom, getRoom, joinRoom, pendingResult, roomPath, stashResult, startRoom } from './roomApi'
import type { RoomView, PlayerStatus } from './roomTypes'
import type { DuelPlayerResult } from './types'

const status: Record<PlayerStatus, string> = { invited: 'Ещё не присоединился', ready: 'Готов к игре', playing: 'Проходит испытание', finished: 'Завершил' }
export function RoomPage() {
  const { roomId = '' } = useParams()
  return <RoomSession key={roomId} id={roomId} />
}
function RoomSession({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomView | null>(null)
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<DuelPlayerResult | null>(() => pendingResult(id))
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState(window.location.origin)
  const saved = useRef(false)
  const finishing = useRef(false)
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try { const next = await getRoom(id); if (!disposed) { setRoom(previous => mergeRoom(previous, next)); setConnectionError('') } }
      catch (error) { if (!disposed) setConnectionError(errorText(error)) }
      if (!disposed) timer = setTimeout(refresh, 2500)
    }
    void refresh()
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      void fetch('/api/duel-network').then(r => r.json()).then(data => { if (!disposed && data.origin) setOrigin(data.origin) }).catch(() => {})
    }
    return () => { disposed = true; clearTimeout(timer) }
  }, [id])
  useEffect(() => {
    if (!room?.results || !room.role || saved.current) return
    saved.current = true
    useGameStore.getState().saveDuel({ id: room.id, challengeType: room.challengeType, scenarioId: room.scenarioId,
      seed: room.seed, challengerResult: room.results.host, opponentResult: room.results.guest, completedAt: new Date().toISOString() })
  }, [room])
  async function sendResult(result: DuelPlayerResult) {
    if (!room || finishing.current) return
    finishing.current = true; setBusy(true); setError('')
    try { const next = await finishRoom(room, result); setRoom(previous => mergeRoom(previous, next)); setPending(null) }
    catch (error) { setError(errorText(error)) }
    finally { finishing.current = false; setBusy(false) }
  }
  function finish(result: ResultPayload) {
    const summary = summarizeResult(result)
    stashResult(id, summary); setPending(summary); setStarted(false)
    void sendResult(summary)
  }
  const invite = `${origin}${roomPath(id)}`
  if (!room) return <section className="mx-auto max-w-2xl px-5 py-16 text-chalk-200"><h1 className="text-3xl">Открываем дуэль</h1><p role="status" className="mt-5">{connectionError || 'Подключаемся к комнате…'}</p><Link to="/play" className="mt-6 inline-block text-violet-soft">К испытаниям</Link></section>
  const mine = room.role ? room[room.role] : null
  const other = room.role === 'guest' ? room.host : room.guest
  if (room.results && room.role) return <>
    <div className="mx-auto max-w-5xl px-5 pt-8"><Link to="/play" className="text-violet-soft">← К испытаниям</Link></div>
    <DuelComparison payload={{ version: 1, mode: 'duel', challengeType: room.challengeType, scenarioId: room.scenarioId,
      seed: room.seed, createdAt: room.createdAt, challengerResult: room.results[room.role === 'host' ? 'guest' : 'host'] }} yours={room.results[room.role]} />
  </>
  if (started && mine === 'playing' && !pending) return <>
    <div className="mx-auto max-w-5xl px-5 pt-5 text-sm text-chalk-400" role="status">Дуэль · Соперник: {status[other]}{connectionError && ' · Связь прервана. Продолжай — результат сохраним и отправим после восстановления.'}</div>
    <DuelGame market={room} onComplete={finish} />
  </>
  return <section className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-12 text-chalk-200">
    <Link to="/play" className="text-sm text-chalk-400">← К испытаниям</Link>
    <p className="text-sm text-violet-soft">Дуэль · {challengeTitles[room.challengeType]}</p>
    <h1 className="text-3xl text-chalk-50">{mine === 'finished' ? 'Твой результат сохранён' : room.role ? 'Комната на двоих' : 'Друг приглашает тебя в дуэль'}</h1>
    <p>{mine === 'finished' ? 'Ждём завершения соперника. Сравнение появится здесь автоматически. Можно закрыть страницу и вернуться позже.' : 'У вас один и тот же рынок и независимые решения. Можно начать сразу, не дожидаясь друг друга. Результаты откроются после завершения обоих.'}</p>
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-ink-700 p-5"><p className="text-chalk-50">{room.role === 'host' ? 'Ты' : 'Создатель'}</p><p className="mt-2 text-sm text-chalk-400">{status[room.host]}</p></div>
      <div className="rounded-xl border border-ink-700 p-5"><p className="text-chalk-50">{room.role === 'guest' ? 'Ты' : 'Друг'}</p><p className="mt-2 text-sm text-chalk-400">{status[room.guest]}</p></div>
    </div>
    {(error || connectionError) && <p role="alert" className="text-sm text-market-down">{error || connectionError}</p>}
    {pending ? <div className="flex flex-col gap-3"><p>Прохождение сохранено на этом устройстве. Отправь результат в комнату для сравнения.</p><Button disabled={busy} onClick={() => void sendResult(pending)}>{busy ? 'Сохраняем результат…' : 'Отправить результат'}</Button></div>
      : !room.role ? <Button variant="primary" disabled={busy || room.guest !== 'invited'} onClick={async () => {
        setBusy(true); setError('')
        try { const next = await joinRoom(id, room.challengeType); setRoom(previous => mergeRoom(previous, next)) } catch (error) { setError(errorText(error)) } finally { setBusy(false) }
      }}>{room.guest !== 'invited' ? 'В комнате уже два игрока' : 'Присоединиться к дуэли'}</Button>
      : mine !== 'finished' && <div className="flex flex-col gap-3"><Button variant="primary" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { const next = await startRoom(id); setRoom(previous => mergeRoom(previous, next)); setStarted(true) } catch (error) { setError(errorText(error)) } finally { setBusy(false) }
      }}>{busy ? 'Подключаемся…' : mine === 'playing' ? 'Начать своё прохождение заново' : 'Начать своё прохождение'}</Button>
      {mine === 'playing' && <p className="text-sm text-chalk-400">Незавершённая попытка начнётся с начала на том же рынке. На игру друга это не повлияет.</p>}</div>}
    {room.role === 'host' && <div className="flex flex-col gap-3 rounded-xl border border-ink-700 p-5">
      <h2 className="text-lg text-chalk-50">Пригласи друга</h2>
      <p className="text-sm text-chalk-400">Отправь эту ссылку. Она открывает место второго игрока.</p>
      <input aria-label="Ссылка для друга" readOnly value={invite} onFocus={event => event.target.select()} className="w-full rounded border border-ink-700 bg-ink-950 p-3 text-sm" />
      <Button onClick={async () => { try { await navigator.clipboard.writeText(invite); setCopied(true) } catch { setCopied(false); setError('Скопируй ссылку из поля выше.') } }}>{copied ? 'Ссылка скопирована' : 'Скопировать приглашение'}</Button>
      {origin !== window.location.origin && <p className="text-xs text-chalk-400">Для теста в общей Wi-Fi сети. Оставь сервер на компьютере включённым.</p>}
    </div>}
  </section>
}
