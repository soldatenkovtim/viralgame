import type { ReactNode } from 'react'
import type { ResultPayload } from '@/store/gameStore'
import type { DuelPayload } from './types'
import { ResultContext } from './resultContext'
import { CreateRoomButton } from './CreateRoom'
export function DuelResultShare({ payload, children }: { payload: ResultPayload; children: ReactNode }) {
  return <ResultContext.Provider value={payload}>{children}</ResultContext.Provider>
}
export function DuelShareButton({ result, original }: { result?: ResultPayload; original?: DuelPayload }) {
  const challengeType = result?.challengeType ?? original?.challengeType
  return challengeType ? <div className="flex flex-col gap-3">
    <CreateRoomButton challengeType={challengeType} label="Создать новую дуэль" />
    <p className="text-sm text-chalk-400">Новая комната и новое прохождение для вас обоих. Текущий результат в дуэль не переносится.</p>
  </div> : null
}
