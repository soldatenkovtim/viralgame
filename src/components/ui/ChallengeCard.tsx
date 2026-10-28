import { ArrowUpRight, Check, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { challengeNumbers, challengeRoutes, challengeTitles } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

export const challengeDescriptions: Record<ChallengeType, string> = {
  'blind-market': 'Примите решение, не зная ни тикера, ни даты.',
  'market-maker': 'Котируйте рынок и попробуйте понять, кто торгует против вас.',
  'black-swan': 'Вы уже в позиции. Рынок внезапно меняется.',
  'cross-arbitrage':
    'Один актив, несколько площадок. Найдите исполнимый edge и не дайте объёму съесть прибыль.',
}

export const challengeDurations: Record<ChallengeType, string> = {
  'blind-market': '3–4 минуты · 3 решения',
  'market-maker': '60 секунд · живой поток',
  'black-swan': '2–3 минуты · 3 фазы',
  'cross-arbitrage': '1,5–2 минуты · 5 рынков',
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
      <div className="flex min-h-5 items-center justify-between">
        <span className="tnum font-mono text-xs tracking-[0.1em] text-chalk-500">
          {challengeNumbers[challenge]}
        </span>
        {locked ? (
          <Lock className="h-4 w-4 text-chalk-500" aria-hidden />
        ) : completed ? (
          <span className="flex items-center gap-1.5 text-[11px] tracking-wide text-violet-soft">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Пройдено
          </span>
        ) : <ArrowUpRight className="h-5 w-5 text-violet-accent" aria-hidden />}
      </div>

      <TrialSignal challenge={challenge} />

      <div className="mt-5 mb-6 flex flex-col gap-2">
        <h3 className="text-xl font-bold tracking-tight text-chalk-50">
          {challengeTitles[challenge]}
        </h3>
        <p className="text-sm leading-relaxed text-chalk-400">
          {challengeDescriptions[challenge]}
        </p>
      </div>

      <div className="mt-auto flex min-h-15 flex-wrap content-start items-start justify-between gap-2 border-t border-ink-800 pt-4">
        <span className="text-xs text-chalk-500">
          {challengeDurations[challenge]}
        </span>
        {bestPoints !== undefined ? (
          <span className="tnum text-xs text-chalk-400">
            Лучший: {bestPoints.toLocaleString('ru-RU')}
          </span>
        ) : null}
      </div>
      <span className="challenge-action">{locked ? 'Выбрать режим' : completed ? 'Пройти ещё раз' : 'Начать испытание'}<ArrowUpRight size={18} aria-hidden /></span>
      {locked && <span className="mt-2 text-xs leading-relaxed text-chalk-500">Стандартный — после предыдущего. Дуэль доступна.</span>}
    </>
  )

  const shell =
    'challenge-card flex h-full flex-col border border-t-2 p-6 transition-colors duration-200'

  return (
    <Link
      to={challengeRoutes[challenge]}
      data-challenge={challenge}
      aria-label={`${challengeTitles[challenge]} — выбрать режим`}
      className={`${shell} border-ink-700 border-t-chalk-50 bg-ink-950 hover:border-violet-accent hover:bg-ink-900`}
    >
      {content}
    </Link>
  )
}

/** Abstract market signals; decorative, never presented as live prices. */
function TrialSignal({ challenge }: { challenge: ChallengeType }) {
  const paths: Record<ChallengeType, string[]> = {
    'blind-market': ['M0 52 L24 52 L38 42 L60 48 L78 25 L96 33 L118 12 L138 22 L160 9 L180 18 L210 4'],
    'market-maker': ['M0 18 H36 V26 H78 V34 H118 V42 H160 V50 H210', 'M0 58 H36 V50 H78 V42 H118 V34 H160 V26 H210'],
    'black-swan': ['M0 24 L30 20 L60 25 L84 18 L104 22 L116 65 L132 48 L145 58 L165 42 L183 47 L210 35'],
    'cross-arbitrage': ['M0 38 L40 22 L80 38 L120 22 L160 38 L210 22', 'M0 50 L40 34 L80 50 L120 34 L160 50 L210 34'],
  }
  return <div className="trial-signal" aria-hidden><svg viewBox="0 0 210 72" fill="none" preserveAspectRatio="none">
    <path d="M0 18 H210 M0 36 H210 M0 54 H210 M42 0 V72 M84 0 V72 M126 0 V72 M168 0 V72" className="signal-grid" />
    {paths[challenge].map((path, index) => <path key={path} d={path} className={index ? 'signal-secondary' : 'signal-primary'} />)}
  </svg><span>{challenge === 'blind-market' ? 'SIGNAL / UNKNOWN' : challenge === 'market-maker' ? 'BID / ASK' : challenge === 'black-swan' ? 'RISK / REACTION' : 'SPREAD / EXECUTION'}</span></div>
}
