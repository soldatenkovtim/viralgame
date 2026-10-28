import { weightedChallengeScore } from '@/lib/profile'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'
import { buildLeaderboard } from '@/data/leaderboard'
import { trackEvent } from '@/lib/analytics'
import { formatNumber } from '@/lib/formatting'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function LeaderboardPage() {
  const [mode, setMode] = useState<'standard' | 'advanced'>('standard')
  const advancedBests = useGameStore(s => s.advancedBests)
  const completed = useGameStore((state) => state.completedChallenges)
  const profile = useGameStore((state) => state.tradingProfile)
  const playerName = useGameStore((state) => state.playerName)
  const bestOverallScore = useGameStore((state) => state.bestOverallScore)

  const complete = mode === 'standard' ? completed.length === CHALLENGE_ORDER.length : CHALLENGE_ORDER.every(t => advancedBests[t] !== undefined)
  const score = mode === 'standard' ? bestOverallScore() : Math.round(weightedChallengeScore({ blindMarket: advancedBests['blind-market'] ?? 0, marketMaker: advancedBests['market-maker'] ?? 0, blackSwan: advancedBests['black-swan'] ?? 0, crossArbitrage: advancedBests['cross-arbitrage'] ?? 0 }))

  // В рейтинге учитывается лучший результат каждого испытания, а не последний.
  const rows = useMemo(
    () =>
      buildLeaderboard(
        complete
          ? {
              nickname: playerName || 'вы',
              score,
              archetype: mode === 'advanced' ? 'Продвинутый режим' : profile?.archetype ?? 'Системный трейдер',
            }
          : null,
      ),
    [complete, playerName, score, profile, mode],
  )

  const myRank = rows.find((row) => row.isCurrentUser)?.rank

  useEffect(() => {
    trackEvent('leaderboard_viewed', { complete, rank: myRank ?? null })
  }, [complete, myRank])

  return (
    <div className="site-container page-layout flex flex-col">
      <div className="flex gap-3" aria-label="Режим рейтинга">{(['standard', 'advanced'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-lg border px-4 py-3 text-sm ${mode === m ? 'border-violet-accent text-chalk-50' : 'border-ink-700 text-chalk-400'}`}>{m === 'standard' ? 'Стандартный' : 'Продвинутый'}</button>)}</div>
      <header className="flex flex-col gap-5">
        <SectionLabel>Рейтинг участников</SectionLabel>
        <h1 className="text-4xl font-extrabold tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Рейтинг участников
        </h1>
        <p className="text-sm text-chalk-400">Сравните свои результаты с другими участниками и поборитесь за место среди лидеров.</p>
        {complete ? (
          <p className="tnum text-sm text-chalk-200">
            Ваш результат: {formatNumber(score)} очков · сохранён на этом устройстве
          </p>
        ) : (
          <p className="text-sm text-chalk-400">
            Пройдите все четыре испытания, чтобы попасть в таблицу.
          </p>
        )}
      </header>

      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-ink-700 text-left">
              <Th className="w-16">Место</Th>
              <Th>Ник</Th>
              <Th>Архетип</Th>
              <Th className="text-right">Очки</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-sm text-chalk-400">Пока нет завершённой серии в этом режиме.</td></tr>}
            {rows.map((row) => (
              <tr
                key={`${row.rank}-${row.nickname}`}
                className={`border-b border-ink-800 transition-colors ${
                  row.isCurrentUser ? 'bg-violet-dim/30' : 'hover:bg-ink-900'
                }`}
              >
                <Td className="tnum text-chalk-500">{row.rank ?? '—'}</Td>
                <Td
                  className={row.isCurrentUser ? 'text-violet-soft' : 'text-chalk-50'}
                >
                  {row.nickname}
                  {row.isCurrentUser ? (
                    <span className="ml-2 text-[11px] tracking-wider text-chalk-500 uppercase">
                      это вы
                    </span>
                  ) : null}
                </Td>
                <Td className="text-chalk-400">{row.archetype}</Td>
                <Td className="tnum text-right text-chalk-200">
                  {formatNumber(row.score)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-ink-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer>
          Общий рейтинг пока не подключён: доступны только ваши локальные результаты,
          без места среди других участников. Очки — игровая величина. Для сравнения с другим игроком выберите дуэль.
        </Disclaimer>
        <LinkButton to={complete ? '/profile' : '/play'} variant="secondary" size="lg">
          {complete ? 'Вернуться к профилю' : 'К испытаниям'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`py-3 text-[11px] font-medium tracking-[0.14em] text-chalk-500 uppercase ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3.5 text-sm ${className}`}>{children}</td>
}
