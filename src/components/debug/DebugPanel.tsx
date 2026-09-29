import { scenarioPool } from '@/modes/scenarios'
import { useState } from 'react'
import { Bug, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDebugParams } from '@/hooks/useDebug'
import { seedCompletedSeries } from '@/lib/debugSeed'
import { CHALLENGE_ORDER, challengeTitles, useGameStore } from '@/store/gameStore'

/**
 * Панель разработчика. Включается флагом ?debug=1 и нужна только для того,
 * чтобы быстро попадать в нужное место сценария при ручном тестировании.
 */
export function DebugPanel() {
  const debug = useDebugParams()
  const mode = useGameStore(s => s.selectedMode) === 'advanced' ? 'advanced' : 'standard'
  const blindMarketScenarios = scenarioPool('blind-market', mode)
  const marketMakerScenarios = scenarioPool('market-maker', mode)
  const marketShockScenarios = scenarioPool('black-swan', mode)
  const crossArbitrageSessions = scenarioPool('cross-arbitrage', mode)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)

  const resetProgress = useGameStore((state) => state.resetProgress)
  const unlockChallenge = useGameStore((state) => state.unlockChallenge)
  const completed = useGameStore((state) => state.completedChallenges)

  if (!debug.enabled) return null

  const goTo = (path: string, scenario?: string) => {
    const params = new URLSearchParams()
    params.set('debug', '1')
    if (scenario) params.set('scenario', scenario)
    if (debug.timerDisabled) params.set('timer', 'off')
    navigate(`${path}?${params.toString()}`)
  }

  const toggleTimer = () => {
    const next = new URLSearchParams(searchParams)
    if (debug.timerDisabled) next.delete('timer')
    else next.set('timer', 'off')
    setSearchParams(next, { replace: true })
  }

  const clearStorage = () => {
    window.localStorage.clear()
    window.location.reload()
  }

  const unlockAll = () => {
    CHALLENGE_ORDER.forEach(unlockChallenge)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-4 bottom-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-chalk-400 shadow-lg"
        aria-label="Открыть панель разработчика"
      >
        <Bug className="h-4 w-4" aria-hidden />
      </button>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-h-[80vh] w-[300px] flex-col overflow-y-auto rounded-xl border border-ink-600 bg-ink-850/95 p-4 text-xs shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 tracking-[0.16em] text-chalk-400 uppercase">
          <Bug className="h-3.5 w-3.5" aria-hidden />
          Debug
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-chalk-500 hover:text-chalk-50"
          aria-label="Свернуть панель"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <Group title="Испытания">
        {CHALLENGE_ORDER.map((challenge) => (
          <Row
            key={challenge}
            label={challengeTitles[challenge]}
            onClick={() => goTo(`/challenge/${challenge}`)}
          />
        ))}
      </Group>

      <Group title="Сценарии · слепой рынок">
        {blindMarketScenarios.map((scenario) => (
          <Row
            key={scenario.id}
            label={`${scenario.id} · ${scenario.title}`}
            active={debug.scenario === scenario.id}
            onClick={() => goTo('/challenge/blind-market', scenario.id)}
          />
        ))}
      </Group>

      <Group title="Смена потока · маркет-мейкер">
        {marketMakerScenarios.map((scenario) => (
          <Row
            key={scenario.id}
            label={scenario.title}
            active={debug.scenario === scenario.id}
            onClick={() => goTo('/challenge/market-maker', scenario.id)}
          />
        ))}
      </Group>

      <Group title="Сценарии · рыночный шок">
        {marketShockScenarios.map((scenario) => (
          <Row
            key={scenario.id}
            label={scenario.id}
            active={debug.scenario === scenario.id}
            onClick={() => goTo('/challenge/black-swan', scenario.id)}
          />
        ))}
      </Group>

      <Group title="Наборы рынков · кросс-арбитраж">
        {crossArbitrageSessions.map((session) => (
          <Row
            key={session.id}
            label={session.id}
            active={debug.scenario === session.id}
            onClick={() => goTo('/challenge/cross-arbitrage', session.id)}
          />
        ))}
      </Group>

      <Group title="Состояние">
        <Row
          label={debug.timerDisabled ? 'Таймер: выключен' : 'Таймер: включён'}
          onClick={toggleTimer}
        />
        <Row label="Открыть все испытания" onClick={unlockAll} />
        <Row
          label="Финальный профиль"
          onClick={() => {
            seedCompletedSeries()
            goTo('/profile')
          }}
        />
        <Row label="Рейтинг" onClick={() => goTo('/leaderboard')} />
        <Row
          label="Сбросить прогресс"
          danger
          onClick={() => {
            resetProgress()
            goTo('/')
          }}
        />
        <Row label="Очистить localStorage" danger onClick={clearStorage} />
      </Group>

      <p className="mt-3 border-t border-ink-700 pt-3 text-[11px] text-chalk-500">
        Пройдено: {completed.length} / {CHALLENGE_ORDER.length}
      </p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <span className="mb-1 text-[10px] tracking-[0.14em] text-chalk-500 uppercase">
        {title}
      </span>
      {children}
    </div>
  )
}

function Row({
  label,
  onClick,
  active,
  danger,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1.5 text-left transition-colors ${
        active
          ? 'border-violet-accent/60 bg-violet-accent/12 text-chalk-50'
          : danger
            ? 'border-ink-700 text-market-down hover:border-market-down/40'
            : 'border-ink-700 text-chalk-300 hover:border-ink-500 hover:text-chalk-50'
      }`}
    >
      {label}
    </button>
  )
}
