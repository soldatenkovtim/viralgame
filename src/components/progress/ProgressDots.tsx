import { CHALLENGE_ORDER, challengeTitles, useGameStore } from '@/store/gameStore'
import { profileCompletion } from '@/lib/profile'
import type { ChallengeType } from '@/types/game'

export function ProgressDots({ current }: { current?: ChallengeType }) {
  const completed = useGameStore((state) => state.completedChallenges)

  return (
    <div className="flex items-center gap-0">
      {CHALLENGE_ORDER.map((challenge, index) => {
        const isDone = completed.includes(challenge)
        const isCurrent = challenge === current

        return (
          <div key={challenge} className="flex items-center">
            {index > 0 ? (
              <div
                className={`h-px w-8 sm:w-12 ${isDone || isCurrent ? 'bg-violet-accent/50' : 'bg-ink-700'}`}
              />
            ) : null}
            <div className="flex flex-col items-center gap-2">
              <span
                className={`block h-2.5 w-2.5 rounded-full border transition-colors ${
                  isDone
                    ? 'border-violet-accent bg-violet-accent'
                    : isCurrent
                      ? 'border-violet-accent bg-transparent'
                      : 'border-ink-600 bg-transparent'
                }`}
                aria-hidden
              />
              <span
                className={`tnum text-[11px] ${isCurrent || isDone ? 'text-chalk-200' : 'text-chalk-500'}`}
              >
                {index + 1}
              </span>
            </div>
          </div>
        )
      })}

      <span className="ml-4 hidden text-xs text-chalk-500 sm:block">
        {current ? challengeTitles[current] : `${completed.length} / 3 испытаний`}
      </span>
    </div>
  )
}

export function ProfileMeter({ className = '' }: { className?: string }) {
  const completed = useGameStore((state) => state.completedChallenges)
  const percent = profileCompletion(completed.length)

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-chalk-500">
          Профиль трейдера
        </span>
        <span className="tnum text-sm text-chalk-200">
          {percent === 100 ? 'Готов' : `${percent}%`}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-violet-accent transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function ChallengeCounter() {
  const completed = useGameStore((state) => state.completedChallenges)
  return (
    <span className="tnum text-sm text-chalk-400">
      {completed.length} / {CHALLENGE_ORDER.length} испытаний
    </span>
  )
}
