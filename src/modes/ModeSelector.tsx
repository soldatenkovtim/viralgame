import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useGameStore, CHALLENGE_ORDER, challengeTitles, challengeNumbers } from '@/store/gameStore'
import { Button } from '@/components/ui/Button'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import { useDebugParams } from '@/hooks/useDebug'
import type { ChallengeType } from '@/types/game'
import { CreateRoom } from '@/duel/CreateRoom'
import { trialModeState } from '@/components/home/trialState'
import type { GameMode } from './config'
const labels: Record<GameMode, string> = { standard: 'Стандартный', advanced: 'Продвинутый', duel: 'Дуэль' }
const descriptions: Record<GameMode, string> = {
  standard: 'Четыре испытания, которые открываются по очереди.',
  advanced: 'Те же механики. Меньше подсказок, сложнее рынок.',
  duel: 'Один рынок. Два трейдера. Сравните решения после прохождения.',
}

export function ModeSelector() {
  const state = useGameStore()
  return (
    <section aria-labelledby="mode-heading">
      <h2 id="mode-heading" className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-chalk-400">Режим</h2>
      <div className="grid items-stretch gap-4 sm:grid-cols-3">
        {(Object.keys(labels) as GameMode[]).map(mode => {
          const selected = state.selectedMode === mode
          const locked = mode === 'advanced' && !state.advancedUnlocked
          const count = mode === 'duel' ? state.duelHistory.length : new Set((mode === 'advanced' ? state.advancedResults : state.standardResults).map(r => r.challengeType)).size
          const status = selected ? 'Текущий режим' : mode === 'standard' ? 'Выбрать режим' : mode === 'advanced'
            ? locked ? 'Откроется после стандартной серии' : 'Открыт'
            : locked ? 'После первого испытания' : 'Бросить вызов'
          return (
            <button key={mode} type="button" aria-label={labels[mode]} aria-pressed={selected} disabled={locked}
              onClick={() => state.setMode(mode)}
              className={`flex min-h-48 h-full flex-col border p-5 lg:p-6 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-accent disabled:cursor-not-allowed ${selected
                ? 'border-violet-accent bg-violet-accent/10'
                : 'border-ink-700 bg-ink-900 enabled:hover:border-ink-500 enabled:hover:bg-ink-850'} ${locked ? 'opacity-55' : ''}`}>
              <span className="text-xl font-normal tracking-tight text-chalk-50">{labels[mode]}</span>
              <span className="mt-3 text-sm leading-relaxed text-chalk-400">{descriptions[mode]}</span>
              <span className="mt-auto pt-5 tnum text-lg text-chalk-200">{mode === 'duel' ? `${count} дуэлей завершено` : `${count} / 4 пройдено`}</span>
              <span className={`mt-4 border-t pt-4 text-sm ${selected ? 'border-violet-accent/25 text-violet-soft' : 'border-ink-700 text-chalk-400'}`}>{status}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
export function ModeBoundary({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation()
  const challenge = CHALLENGE_ORDER.find(type => pathname.endsWith(`/${type}`))
  if (!challenge) return children
  return <ChallengeEntry key={`${pathname}/${search}`} challenge={challenge}>{children}</ChallengeEntry>
}

function ChallengeEntry({ challenge, children }: { challenge: ChallengeType; children: ReactNode }) {
  const location = useLocation()
  const state = useGameStore()
  const mode = state.selectedMode
  // Cards already selected a mode. Keep the same access checks for direct entry.
  const [started, setStarted] = useState(() => location.state?.trialMode === mode
    && trialModeState(state, challenge, mode).available)
  const debug = useDebugParams()
  if (started || debug.enabled) {
    return mode === 'duel' ? <CreateRoom challengeType={challenge} />
      : <ChallengeGate challenge={challenge}>{children}</ChallengeGate>
  }
  return <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-12 sm:px-8 sm:py-20">
    <header><p className="micro-label mb-4 text-violet-accent">[ ИСПЫТАНИЕ {challengeNumbers[challenge]} ]</p>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{challengeTitles[challenge]}</h1>
      <p className="mt-4 text-sm leading-relaxed text-chalk-400">Выберите условия рынка. Правила появятся перед началом испытания.</p>
    </header>
    <ModeSelector />
    {mode === 'duel' ? <Button variant="primary" className="self-start" onClick={() => setStarted(true)}>Продолжить в дуэль ↗</Button>
      : <ChallengeGate challenge={challenge} compact><Button variant="primary" className="self-start" onClick={() => setStarted(true)}>Начать испытание ↗</Button></ChallengeGate>}
  </div>
}
