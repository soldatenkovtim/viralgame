import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { challengeTitles } from '@/store/gameStore'
import { getRoom, roomPath, seats } from './roomApi'
import type { RoomView } from './roomTypes'

export function MyRooms() {
  const [rooms, setRooms] = useState<RoomView[]>([])
  useEffect(() => {
    let active = true
    void Promise.allSettled(seats().slice(-20).reverse().map(seat => getRoom(seat.id))).then(results => {
      if (active) setRooms(results.flatMap(r => r.status === 'fulfilled' && r.value.role ? [r.value] : []))
    })
    return () => { active = false }
  }, [])
  if (!rooms.length) return null
  return <section className="mb-8 rounded-xl border border-ink-700 p-5">
    <h2 className="mb-4 text-lg text-chalk-50">Твои дуэли</h2>
    <div className="flex flex-col gap-3">{rooms.map(room => <Link key={room.id} to={roomPath(room.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-850 px-4 py-3 text-sm text-chalk-200 hover:text-violet-soft">
      <span>{challengeTitles[room.challengeType]} · {new Date(room.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      <span>{room.results ? 'Смотреть сравнение →' : room[room.role!] === 'finished' ? 'Ожидаем соперника →' : 'Вернуться в комнату →'}</span>
    </Link>)}</div>
  </section>
}
