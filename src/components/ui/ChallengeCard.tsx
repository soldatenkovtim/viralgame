import { Check, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { challengeNumbers, challengeRoutes, challengeTitles } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

export const challengeDescriptions: Record<ChallengeType, string> = {
  'blind-market': 'Прими решение, не зная ни тикера, ни даты.',
  'market-maker': 'Котируй рынок и попробуй понять, кто торгует против тебя.',
  'black-swan': 'Ты уже в позиции. Рынок внезапно меняется.',
}

export const challengeDurations: Record<ChallengeType, string> = {
  'blind-market': '3–4 минуты · 3 решения',
  'market-maker': '60 секунд · живой поток',
  'black-swan': '2–3 минуты · 3 фазы',
}

export function ChallengeCard({
  challenge,
  locked,
  completed,
  bestPoints,
}: {
  challenge: ChallengeType
  locked: boolean
  completed: boolean
  bestPoints?: number
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <span className="tnum text-sm tracking-[0.2em] text-chalk-500">
          {challengeNumbers[challenge]}
        </span>
        {locked ? (
          <Lock className="h-4 w-4 text-chalk-500" aria-hidden />
        ) : completed ? (
          <span className="flex items-center gap-1.5 text-[11px] tracking-wide text-violet-soft">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Пройдено
          </span>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <h3 className="text-xl font-normal tracking-tight text-chalk-50">
          {challengeTitles[challenge]}
        </h3>
        <p className="text-sm leading-relaxed text-chalk-400">
          {challengeDescriptions[challenge]}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-ink-800 pt-4">
        <span className="text-xs text-chalk-500">
          {locked ? 'Откроется после предыдущего' : challengeDurations[challenge]}
        </span>
        {bestPoints !== undefined ? (
          <span className="tnum text-xs text-chalk-400">
            Лучший: {bestPoints.toLocaleString('ru-RU')}
          </span>
        ) : null}
      </div>
    </>
  )

  const shell =
    'flex h-full flex-col rounded-xl border p-6 transition-colors duration-200'

  if (locked) {
    return (
      <div className={`${shell} border-ink-800 bg-ink-950 opacity-55`} aria-disabled>
        {content}
      </div>
    )
  }

  return (
    <Link
      to={challengeRoutes[challenge]}
      className={`${shell} border-ink-700 bg-ink-900 hover:border-violet-accent/50 hover:bg-ink-850`}
    >
      {content}
    </Link>
  )
}
