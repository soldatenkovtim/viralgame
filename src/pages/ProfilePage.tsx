import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { CompanyCta } from '@/components/layout/CompanyCta'
import { TraitBars } from '@/components/results/TraitBars'
import { ShareCard } from '@/components/share/ShareCard'
import { Button, LinkButton } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { trackEvent } from '@/lib/analytics'
import { formatNumber } from '@/lib/formatting'
import { archetypeTagline, buildTradingProfile, refreshProfileNarrative, traitLabels } from '@/lib/profile'
import { profileObservations } from '@/lib/profilePresentation'
import { findScenarioById } from '@/modes/scenarios'
import { CHALLENGE_ORDER, challengeTitles, useGameStore } from '@/store/gameStore'

export function ProfilePage() {
  const navigate = useNavigate()
  const restartDialog = useRef<HTMLDialogElement>(null)
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
  const input = { blindMarket: blindMarketResult, marketMaker: marketMakerResult, blackSwan: blackSwanResult, crossArbitrage: crossArbitrageResult }

  // Профиль по умолчанию — последнее полное прохождение серии.
  const profile = useMemo(() => {
    // Формулировки обновляются и для ранее сохранённых результатов.
    if (storedProfile) return refreshProfileNarrative(storedProfile, {
      blindMarket: blindMarketResult,
      marketMaker: marketMakerResult,
      blackSwan: blackSwanResult,
      crossArbitrage: crossArbitrageResult,
    })
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
  const observations = profileObservations(profile, input)
  const results = { 'blind-market': blindMarketResult, 'market-maker': marketMakerResult, 'black-swan': blackSwanResult, 'cross-arbitrage': crossArbitrageResult }

  return (
    <div className="site-container page-layout flex flex-col">
      <header className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-accent" aria-hidden />
          <span className="text-[11px] tracking-[0.22em] text-violet-soft uppercase">
            Рыночный вызов — испытания завершены
          </span>
        </div>

        <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-chalk-50 sm:text-5xl">
          Ваш профиль в этой игровой сессии
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-chalk-400">
          Он описывает ваши решения в игре «Рыночный вызов» и не является
          профессиональной оценкой.
        </p>

        <div className="tnum flex flex-wrap items-center gap-x-8 gap-y-3 pt-2 text-sm text-chalk-400">
          <span>
            {CHALLENGE_ORDER.length} / {CHALLENGE_ORDER.length} испытаний завершено
          </span>
          <span>Средний игровой балл: <span className="text-chalk-50">{formatNumber(overallScore())}</span></span>
        </div>
        <details className="max-w-2xl text-xs leading-relaxed text-chalk-500">
          <summary className="w-fit cursor-pointer rounded text-chalk-400 hover:text-violet-soft focus-visible:outline-2 focus-visible:outline-violet-accent">Как рассчитывается балл?</summary>
          <p className="mt-3">Среднее результатов четырёх испытаний текущей серии: каждое даёт 25%. Итог переводится на шкалу 0–10 000 и округляется. Личные рекорды ниже могут быть из других попыток.</p>
        </details>
      </header>

      <section className="grid gap-10 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:p-10">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <SectionLabel>Архетип</SectionLabel>
            <h2 className="text-[clamp(1.375rem,4vw,2.25rem)] leading-tight font-light tracking-[-0.02em] text-chalk-50 [overflow-wrap:anywhere]">
              {profile.archetype}
            </h2>
            <p className="text-sm text-violet-soft">{archetypeTagline(profile.archetype)}</p>
          </div>

          <div className="flex flex-col gap-5 border-t border-ink-700 pt-5">
            {([{ title: 'Сильные стороны', items: observations.strengths }, { title: 'Зоны роста', items: observations.growth }]).map(group => <div key={group.title}>
              <h3 className="mb-3 text-sm font-medium text-chalk-50">{group.title}</h3>
              {group.items.length ? <ul className="flex flex-col gap-3">{group.items.map(item => <li key={item.trait} className="text-sm leading-relaxed text-chalk-400">
                <details className="group">
                  <summary className="group/thesis flex min-h-11 cursor-pointer list-none items-start gap-3 rounded hover:text-chalk-200 focus-visible:text-chalk-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-accent [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block text-chalk-200 group-hover/thesis:text-violet-soft group-focus-visible/thesis:text-violet-soft">{traitLabels[item.trait]} · <span className="tnum">{item.value}/100</span></span>
                      <span className="block">{item.summary}</span>
                    </span>
                    <ChevronDown size={20} aria-hidden className="mt-0.5 shrink-0 text-chalk-400 group-open:rotate-180 group-open:text-violet-soft group-hover/thesis:text-violet-soft group-focus-visible/thesis:text-violet-soft" />
                  </summary>
                  <p className="mt-3 border-l border-violet-accent/40 pl-3 text-chalk-400">{item.text}</p>
                </details>
              </li>)}</ul> : <p className="text-sm text-chalk-400">Оценки одинаковы: выраженного отличия от остальных характеристик нет.</p>}
            </div>)}
            <p className="text-xs leading-relaxed text-chalk-500">Нажмите на тезис, чтобы увидеть решение. Оценки сравниваются внутри этой сессии и не измеряют квалификацию.</p>
          </div>
        </div>

        <TraitBars profile={profile} input={input} />
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="challenge-results-title">
        <h2 id="challenge-results-title" className="text-2xl font-light tracking-[-0.02em] text-chalk-50">Результаты испытаний</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHALLENGE_ORDER.map((challenge) => (
          <div
            key={challenge}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 px-5 py-5"
          >
            <span className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
              <Check className="h-3.5 w-3.5 text-violet-soft" aria-hidden />
              {challengeTitles[challenge]}
            </span>
            <span className="tnum text-2xl font-light text-chalk-50">
              {personalBests[challenge] === undefined ? '—' : formatNumber(personalBests[challenge])}
            </span>
            <span className="text-xs text-chalk-500">Лучший результат</span>
            {results[challenge] && findScenarioById(challenge, results[challenge]?.scenarioId)
              ? <Link to={`/challenge/${challenge}?view=result`} className="mt-2 inline-flex items-center gap-2 text-xs text-violet-soft hover:underline" aria-label={`${challengeTitles[challenge]}: разбор текущей серии`}>Разбор этой серии <ArrowUpRight size={14} aria-hidden /></Link>
              : <span className="mt-2 text-xs text-chalk-500">Разбор не сохранён</span>}
          </div>
        ))}
        </div>
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

      <CompanyCta source="profile" />

      <div className="flex flex-col gap-4 border-t border-ink-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
        <Button size="lg" onClick={() => restartDialog.current?.showModal()} aria-haspopup="dialog">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Пройти серию заново
        </Button>
        <LinkButton to="/leaderboard" variant="secondary" size="lg">
          Смотреть рейтинг
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
      <dialog ref={restartDialog} aria-labelledby="restart-title" className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-6 text-chalk-200 shadow-2xl backdrop:bg-black/60">
        <h2 id="restart-title" className="text-xl text-chalk-50">Начать серию заново?</h2>
        <p className="mt-4 text-sm leading-relaxed text-chalk-400">Текущий профиль и разборы будут очищены. Личные рекорды и история попыток сохранятся. Скачайте карточку, если хотите оставить этот профиль.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button autoFocus onClick={() => restartDialog.current?.close()}>Оставить профиль</Button>
          <Button variant="primary" onClick={handleRestart}>Начать новую серию</Button>
        </div>
      </dialog>
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
