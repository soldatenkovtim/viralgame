import { useEffect, useMemo } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CompanyCta } from '@/components/layout/CompanyCta'
import { TraitBars } from '@/components/results/TraitBars'
import { ShareCard } from '@/components/share/ShareCard'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'
import { trackEvent } from '@/lib/analytics'
import { formatNumber } from '@/lib/formatting'
import { archetypeTagline, buildTradingProfile } from '@/lib/profile'
import { CHALLENGE_ORDER, challengeTitles, useGameStore } from '@/store/gameStore'

export function ProfilePage() {
  const navigate = useNavigate()
  const completed = useGameStore((state) => state.completedChallenges)
  const storedProfile = useGameStore((state) => state.tradingProfile)
  const blindMarketResult = useGameStore((state) => state.blindMarketResult)
  const marketMakerResult = useGameStore((state) => state.marketMakerResult)
  const blackSwanResult = useGameStore((state) => state.blackSwanResult)
  const crossArbitrageResult = useGameStore((state) => state.crossArbitrageResult)
  const personalBests = useGameStore((state) => state.personalBests)
  const playerName = useGameStore((state) => state.playerName)
  const overallScore = useGameStore((state) => state.overallScore)
  const restartSeries = useGameStore((state) => state.restartSeries)

  const complete = completed.length === CHALLENGE_ORDER.length

  // Профиль по умолчанию — последнее полное прохождение серии.
  const profile = useMemo(() => {
    if (storedProfile) return storedProfile
    if (!complete) return null
    return buildTradingProfile({
      blindMarket: blindMarketResult,
      marketMaker: marketMakerResult,
      blackSwan: blackSwanResult,
      crossArbitrage: crossArbitrageResult,
    })
  }, [
    storedProfile,
    complete,
    blindMarketResult,
    marketMakerResult,
    blackSwanResult,
    crossArbitrageResult,
  ])

  useEffect(() => {
    trackEvent('profile_viewed', {
      complete,
      archetype: profile?.archetype ?? null,
    })
  }, [complete, profile])

  if (!complete || !profile) {
    return <IncompleteProfile completedCount={completed.length} />
  }

  const handleRestart = () => {
    trackEvent('series_restarted', { from: 'profile' })
    restartSeries()
    navigate('/challenge/blind-market')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-12 px-5 py-14 sm:px-8 sm:py-20">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-accent" aria-hidden />
          <span className="text-[11px] tracking-[0.22em] text-violet-soft uppercase">
            Market Trials Complete
          </span>
        </div>

        <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          Твой профиль в этой игровой сессии
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-chalk-400">
          Он описывает твои решения внутри Market Trials и не является
          профессиональной оценкой.
        </p>

        <div className="tnum flex flex-wrap items-center gap-x-8 gap-y-3 pt-2 text-sm text-chalk-400">
          <span>
            {CHALLENGE_ORDER.length} / {CHALLENGE_ORDER.length} испытаний завершено
          </span>
          <span className="text-chalk-500">Профиль собран: 100%</span>
          <span>Игровой score: {formatNumber(overallScore())}</span>
        </div>
      </header>

      <section className="grid gap-10 rounded-xl border border-ink-700 bg-ink-900 p-8 sm:p-10 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <SectionLabel>Архетип</SectionLabel>
            <h2 className="text-3xl leading-tight font-light tracking-[-0.02em] text-chalk-50 sm:text-4xl">
              {profile.archetype}
            </h2>
            <p className="text-sm text-violet-soft">{archetypeTagline(profile.archetype)}</p>
          </div>

          <p className="max-w-xl text-base leading-relaxed text-chalk-200">
            {profile.description}
          </p>

          <Disclaimer>
            Характеристики — игровые. Они описывают поведение в конкретной сессии и
            не измеряют квалификацию.
          </Disclaimer>
        </div>

        <TraitBars profile={profile} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHALLENGE_ORDER.map((challenge) => (
          <div
            key={challenge}
            className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 px-6 py-5"
          >
            <span className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
              <Check className="h-3.5 w-3.5 text-violet-soft" aria-hidden />
              {challengeTitles[challenge]}
            </span>
            <span className="tnum text-2xl font-light text-chalk-50">
              {formatNumber(personalBests[challenge] ?? 0)}
            </span>
            <span className="text-xs text-chalk-500">Лучший результат</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-light tracking-[-0.02em] text-chalk-50">
            Карточка результата
          </h2>
          <p className="text-sm text-chalk-400">
            Её можно скачать или отправить другому трейдеру.
          </p>
        </div>
        <ShareCard profile={profile} playerName={playerName || undefined} />
      </section>

      <div className="flex flex-col gap-4 border-t border-ink-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
        <Button size="lg" onClick={handleRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Пройти серию заново
        </Button>
        <LinkButton to="/leaderboard" variant="secondary" size="lg">
          Посмотреть рейтинг
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>

      <CompanyCta source="profile" />
    </div>
  )
}

function IncompleteProfile({ completedCount }: { completedCount: number }) {
  const nextChallenge = CHALLENGE_ORDER[completedCount] ?? CHALLENGE_ORDER[0]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-24 sm:px-8 sm:py-32">
      <SectionLabel>Профиль трейдера</SectionLabel>
      <h1 className="text-4xl font-extrabold tracking-[-0.025em] text-chalk-50 sm:text-5xl">
        Профиль собирается из четырёх испытаний
      </h1>
      <p className="text-base leading-relaxed text-chalk-400">
        Сейчас пройдено {completedCount} из {CHALLENGE_ORDER.length}. Каждое
        испытание добавляет свою часть характеристик.
      </p>
      <LinkButton
        to={`/challenge/${nextChallenge}`}
        variant="primary"
        size="lg"
        className="self-start"
      >
        {completedCount === 0 ? 'Начать испытания' : 'Продолжить'}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </LinkButton>
    </div>
  )
}
