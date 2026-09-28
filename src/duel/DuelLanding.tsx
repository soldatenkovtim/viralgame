import { DuelGame } from './DuelGame'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { challengeTitles, useGameStore, type ResultPayload } from '@/store/gameStore'
import { trackEvent } from '@/lib/analytics'
import { decodeDuel } from './decodeDuel'
import { summarizeResult } from './createDuel'
import { DuelComparison } from './DuelComparison'
import type { DuelPayload, DuelPlayerResult } from './types'
export function DuelLanding() {
  const { challengeType } = useParams()
  const { search } = useLocation()
  const payload = useMemo(() => decodeDuel(new URLSearchParams(search).get('data'), challengeType), [search, challengeType])
  if (!payload) return <main className="mx-auto max-w-3xl px-5 py-20 text-chalk-200"><h1 className="mb-4 text-3xl">Не удалось открыть вызов</h1><p>Ссылка повреждена или использует неподдерживаемый сценарий. Попроси отправить новую ссылку.</p><Link className="mt-6 inline-block text-violet-soft" to="/play">К испытаниям</Link></main>
  return <DuelRun key={search} payload={payload} />
}
function DuelRun({ payload }: { payload: DuelPayload }) {
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<DuelPlayerResult | null>(null)
  const completed = useRef(false)
  useEffect(() => { trackEvent('duel_opened', { challengeType: payload.challengeType, scenarioId: payload.scenarioId }) }, [payload])
  const finish = (r: ResultPayload) => {
    if (completed.current) return
    completed.current = true
    const yours = summarizeResult(r)
    useGameStore.getState().saveDuel({ id: crypto.randomUUID(), challengeType: payload.challengeType, scenarioId: payload.scenarioId, seed: payload.seed,
      challengerResult: payload.challengerResult, opponentResult: yours, completedAt: new Date().toISOString() })
    setResult(yours)
    trackEvent('duel_completed', { challengeType: payload.challengeType, scenarioId: payload.scenarioId })
  }
  if (result) return <DuelComparison payload={payload} yours={result} />
  if (!started) return <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-20 text-chalk-200">
    <h1 className="text-4xl text-chalk-50">Тебе бросили вызов</h1>
    <p>Вы получите один и тот же рынок. Результат другого трейдера откроется только после твоего прохождения.</p>
    <p>Испытание: {challengeTitles[payload.challengeType]}</p><p>Режим: Дуэль</p>
    <Button variant="primary" onClick={() => { setStarted(true); trackEvent('duel_started', { challengeType: payload.challengeType, seed: payload.seed }) }}>Принять вызов</Button>
  </main>
  return <DuelGame market={payload} onComplete={finish} />
}
