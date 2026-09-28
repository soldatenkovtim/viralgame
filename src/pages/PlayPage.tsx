import { MyRooms } from '@/duel/MyRooms'
import { ModeSelector } from '@/modes/ModeSelector'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileMeter } from '@/components/progress/ProgressDots'
import { Button, LinkButton } from '@/components/ui/Button'
import { ChallengeCard, challengeDescriptions } from '@/components/ui/ChallengeCard'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER, challengeNumbers, challengeRoutes, challengeTitles, useGameStore } from '@/store/gameStore'

export function PlayPage() {
  const state = useGameStore()
  const { selectedMode: mode, advancedResults, advancedBests, advancedUnlocked,
    completedChallenges: standardCompleted, unlockedChallenges: unlocked, personalBests, duelHistory } = state
  const navigate = useNavigate()
  const completed = mode === 'advanced' ? [...new Set(advancedResults.map(r => r.challengeType))] : standardCompleted
  const nextChallenge = CHALLENGE_ORDER.find(challenge => !completed.includes(challenge))
  const allDone = completed.length === CHALLENGE_ORDER.length
  const title = mode === 'duel' ? 'Дуэли' : mode === 'advanced' ? 'Продвинутые испытания' : 'Стандартные испытания'
  const description = mode === 'duel'
    ? 'Выбери испытание и отправь его другому трейдеру. Оба пройдите один рынок. Сравнение откроется, когда вы оба закончите.'
    : mode === 'advanced'
      ? 'Более сложные сценарии без изменения базовых правил.'
      : 'Каждое испытание открывает следующее. Пройди четыре рынка и собери профиль трейдера.'

  const handleRestart = () => {
    trackEvent('series_restarted', { from: 'play' })
    state.restartSeries()
    navigate('/challenge/blind-market')
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 sm:py-14">
      <ModeSelector />
      <section aria-labelledby="challenges-heading" className="mt-12 border-t border-ink-800 pt-10 sm:mt-14">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <h1 id="challenges-heading" className="text-3xl font-light tracking-[-0.02em] text-chalk-50 sm:text-4xl">{title}</h1>
            <p className="max-w-xl text-sm leading-relaxed text-chalk-400">{description}</p>
          </div>
          {mode === 'duel' ? <p className="tnum shrink-0 text-sm text-chalk-400">Дуэлей завершено: {duelHistory.length}</p>
            : <div className="w-full max-w-xs"><ProfileMeter completedCount={completed.length} /></div>}
        </header>

        {mode === 'duel' && <MyRooms />}
        {mode === 'duel' ? (
          <div className="grid gap-4 md:grid-cols-2">
            {CHALLENGE_ORDER.map(challenge => (
              <Link key={challenge} to={challengeRoutes[challenge]} aria-label={`${challengeTitles[challenge]} — Бросить вызов`}
                className="group flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-6 transition-colors hover:border-violet-accent/50 hover:bg-ink-850 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-accent">
                <div className="flex items-baseline gap-4"><span className="tnum text-xs tracking-[0.18em] text-chalk-500">{challengeNumbers[challenge]}</span><h2 className="text-xl text-chalk-50">{challengeTitles[challenge]}</h2></div>
                <p className="text-sm leading-relaxed text-chalk-400">{challengeDescriptions[challenge]}</p>
                <span className="mt-auto flex items-center justify-between border-t border-ink-800 pt-4 text-sm text-violet-soft">Бросить вызов<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGE_ORDER.map(challenge => <ChallengeCard key={challenge} challenge={challenge}
              locked={mode === 'advanced' ? !advancedUnlocked : !unlocked.includes(challenge)}
              completed={completed.includes(challenge)} bestPoints={mode === 'advanced' ? advancedBests[challenge] : personalBests[challenge]} />)}
          </div>
        )}

        {mode !== 'duel' && <div className="mt-10 flex flex-col gap-4 border-t border-ink-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-chalk-400">{allDone ? 'Серия пройдена целиком.' : completed.length === 0 ? 'Начни с первого испытания — оно занимает пару минут.' : `Осталось ${CHALLENGE_ORDER.length - completed.length} из ${CHALLENGE_ORDER.length}.`}</p>
          {allDone ? <div className="flex flex-wrap gap-3">
            {mode === 'standard' ? <><Button onClick={handleRestart}><RotateCcw className="h-4 w-4" aria-hidden />Пройти серию заново</Button><LinkButton to="/profile" variant="primary">Открыть профиль<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton></>
              : <LinkButton to={challengeRoutes['blind-market']} variant="primary">Пройти ещё раз<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>}
          </div> : nextChallenge && <LinkButton to={challengeRoutes[nextChallenge]} variant="primary">Продолжить<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>}
        </div>}
      </section>
    </div>
  )
}
