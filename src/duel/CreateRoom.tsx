import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { challengeTitles } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'
import { createRoom, errorText, roomPath } from './roomApi'

export function CreateRoomButton({ challengeType, label = 'Создать дуэль' }: { challengeType: ChallengeType; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  return <div className="flex flex-col gap-3">
    <Button variant="primary" disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try { const room = await createRoom(challengeType); navigate(roomPath(room.id)) }
      catch (error) { setError(errorText(error)); setBusy(false) }
    }}>{busy ? 'Создаём комнату…' : label}</Button>
    {error && <p role="alert" className="text-sm text-market-down">{error}</p>}
  </div>
}
export function CreateRoom({ challengeType }: { challengeType: ChallengeType }) {
  return <section className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-12 text-chalk-200">
    <p className="text-sm text-violet-soft">Дуэль · {challengeTitles[challengeType]}</p>
    <h1 className="text-3xl text-chalk-50">Новый рынок для вас двоих</h1>
    <p>Создай комнату, отправь ссылку другу и начни играть. Каждый проходит испытание со своего устройства — можно одновременно или в разное время.</p>
    <p className="text-sm text-chalk-400">Оба начинаете с нуля. Сравнение решений откроется обоим, когда вы завершите испытание.</p>
    <CreateRoomButton challengeType={challengeType} />
  </section>
}
