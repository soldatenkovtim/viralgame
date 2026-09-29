import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { createDuel, duelUrl } from './createDuel'
import { shareOrCopy } from '@/lib/sharing'
import { trackEvent } from '@/lib/analytics'
import type { ReactNode } from 'react'
import type { ResultPayload } from '@/store/gameStore'
import type { DuelPayload } from './types'
import { ResultContext } from './resultContext'
export function DuelResultShare({ payload, children }: { payload: ResultPayload; children: ReactNode }) {
  return <ResultContext.Provider value={payload}>{children}</ResultContext.Provider>
}
export function DuelShareButton({ result, original }: { result?: ResultPayload; original?: DuelPayload }) {
  const [shared, setShared] = useState(false)
  if (result || original) return <div className="flex flex-col gap-3">
    <Button variant="secondary" onClick={async () => {
      const payload = result ? createDuel(result) : original!
      const outcome = await shareOrCopy({ title: 'Market Trials', text: 'Пройди тот же рынок и сравним решения.', url: duelUrl(payload) })
      if (outcome !== 'failed') { setShared(true); trackEvent('duel_created', { challengeType: payload.challengeType, scenarioId: payload.scenarioId }) }
    }}>{shared ? 'Ссылка готова' : 'Бросить вызов на этом рынке'}</Button>
    <p className="text-sm text-chalk-400">Друг получит этот же сценарий. Твой результат откроется после его прохождения.</p>
  </div>
  return null
}
