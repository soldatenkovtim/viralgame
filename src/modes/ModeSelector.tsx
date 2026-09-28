import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useGameStore, CHALLENGE_ORDER } from '@/store/gameStore'
import { CreateRoom } from '@/duel/CreateRoom'
import type { GameMode } from './config'
const labels: Record<GameMode, string> = { standard: 'Стандартный', advanced: 'Продвинутый', duel: 'Дуэль' }
const descriptions: Record<GameMode, string> = {
  standard: 'Текущий Market Trials.',
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
              className={`flex min-h-64 h-full flex-col rounded-xl border p-5 lg:p-6 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-accent disabled:cursor-not-allowed ${selected
                ? 'border-violet-accent bg-violet-accent/10'
                : 'border-ink-700 bg-ink-900 enabled:hover:border-ink-500 enabled:hover:bg-ink-850'} ${locked ? 'opacity-55' : ''}`}>
              <span className="text-xl font-normal tracking-tight text-chalk-50">{labels[mode]}</span>
              <span className="mt-3 text-sm leading-relaxed text-chalk-400">{descriptions[mode]}</span>
              <span className="mt-auto pt-8 tnum text-lg text-chalk-200">{mode === 'duel' ? `${count} дуэлей завершено` : `${count} / 4 пройдено`}</span>
              <span className={`mt-4 border-t pt-4 text-sm ${selected ? 'border-violet-accent/25 text-violet-soft' : 'border-ink-700 text-chalk-400'}`}>{status}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
export function ModeBoundary({ children }: { children: ReactNode }) {
  const mode = useGameStore(s => s.selectedMode)
  const { pathname } = useLocation()
  const challengeType = CHALLENGE_ORDER.find(type => pathname.endsWith(`/${type}`))
  return <><div className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-8"><ModeSelector /></div>{mode === 'duel' && challengeType
    ? <CreateRoom challengeType={challengeType} />
    : <div key={mode}>{children}</div>}</>
}
