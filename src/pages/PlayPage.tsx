import { ArrowRight, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ProfileMeter } from '@/components/progress/ProgressDots'
import { Button, LinkButton } from '@/components/ui/Button'
import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER, challengeRoutes, useGameStore } from '@/store/gameStore'

export function PlayPage() {
  const navigate = useNavigate()
  const completed = useGameStore((state) => state.completedChallenges)
  const unlocked = useGameStore((state) => state.unlockedChallenges)
  const personalBests = useGameStore((state) => state.personalBests)
  const restartSeries = useGameStore((state) => state.restartSeries)

  const nextChallenge = CHALLENGE_ORDER.find((challenge) => !completed.includes(challenge))
  const allDone = completed.length === CHALLENGE_ORDER.length

  const handleRestart = () => {
    trackEvent('series_restarted', { from: 'play' })
    restartSeries()
    navigate('/challenge/blind-market')
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
      <header className="flex flex-col gap-8 pb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-light tracking-[-0.02em] text-chalk-50 sm:text-5xl">
            Испытания
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-chalk-400">
            Каждое испытание открывает следующее. Профиль собирается из всех четырёх —
            и описывает только эту игровую сессию.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <ProfileMeter />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHALLENGE_ORDER.map((challenge) => (
          <ChallengeCard
            key={challenge}
            challenge={challenge}
            locked={!unlocked.includes(challenge)}
            completed={completed.includes(challenge)}
            bestPoints={personalBests[challenge]}
          />
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4 border-t border-ink-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
        {allDone ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-chalk-200">Серия пройдена целиком.</span>
              <span className="text-xs text-chalk-500">
                Профиль готов. Его можно пересобрать, пройдя серию заново.
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleRestart}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Пройти серию заново
              </Button>
              <LinkButton to="/profile" variant="primary">
                Открыть профиль
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-chalk-400">
              {completed.length === 0
                ? 'Начни с первого испытания — оно занимает пару минут.'
                : `Осталось ${CHALLENGE_ORDER.length - completed.length} из ${CHALLENGE_ORDER.length}.`}
            </span>
            {nextChallenge ? (
              <LinkButton to={challengeRoutes[nextChallenge]} variant="primary">
                Продолжить
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
