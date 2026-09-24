import { useEffect, useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel } from '@/components/ui/Card'
import { buildLeaderboard } from '@/data/leaderboard'
import { trackEvent } from '@/lib/analytics'
import { formatNumber } from '@/lib/formatting'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function LeaderboardPage() {
  const completed = useGameStore((state) => state.completedChallenges)
  const profile = useGameStore((state) => state.tradingProfile)
  const playerName = useGameStore((state) => state.playerName)
  const bestOverallScore = useGameStore((state) => state.bestOverallScore)

  const complete = completed.length === CHALLENGE_ORDER.length
  const score = bestOverallScore()

  // В рейтинге учитывается лучший результат каждого испытания, а не последний.
  const rows = useMemo(
    () =>
      buildLeaderboard(
        complete
          ? {
              nickname: playerName || 'ты',
              score,
              archetype: profile?.archetype ?? 'Системный трейдер',
            }
          : null,
      ),
    [complete, playerName, score, profile],
  )

  const myRank = rows.find((row) => row.isCurrentUser)?.rank

  useEffect(() => {
    trackEvent('leaderboard_viewed', { complete, rank: myRank ?? null })
  }, [complete, myRank])

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <header className="flex flex-col gap-5">
        <SectionLabel>Тестовый рейтинг</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Рейтинг
        </h1>
        {complete && myRank ? (
          <p className="tnum text-sm text-chalk-200">
            Твоё место: {myRank} из {rows.length} · {formatNumber(score)} очков
          </p>
        ) : (
          <p className="text-sm text-chalk-400">
            Пройди все три испытания, чтобы попасть в таблицу.
          </p>
        )}
      </header>

      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-ink-700 text-left">
              <Th className="w-16">#</Th>
              <Th>Ник</Th>
              <Th>Архетип</Th>
              <Th className="text-right">Score</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.rank}-${row.nickname}`}
                className={`border-b border-ink-800 transition-colors ${
                  row.isCurrentUser ? 'bg-violet-dim/30' : 'hover:bg-ink-900'
                }`}
              >
                <Td className="tnum text-chalk-500">{row.rank}</Td>
                <Td
                  className={row.isCurrentUser ? 'text-violet-soft' : 'text-chalk-50'}
                >
                  {row.nickname}
                  {row.isCurrentUser ? (
                    <span className="ml-2 text-[11px] tracking-wider text-chalk-500 uppercase">
                      это ты
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
          Тестовый рейтинг — данные других участников смоделированы. Score является
          игровой величиной и не отражает результаты реальной торговли.
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
