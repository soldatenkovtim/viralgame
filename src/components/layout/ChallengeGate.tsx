import { Lock } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { useDebugParams } from '@/hooks/useDebug'
import {
  CHALLENGE_ORDER,
  challengeRoutes,
  challengeTitles,
  useGameStore,
} from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

/**
 * Испытания открываются по очереди. Прямой заход по URL не обходит прогресс,
 * кроме debug-режима — там можно прыгать куда угодно.
 */
export function ChallengeGate({
  challenge,
  children,
}: {
  challenge: ChallengeType
  children: React.ReactNode
}) {
  const debug = useDebugParams()
  const unlocked = useGameStore((state) => state.unlockedChallenges.includes(challenge))

  if (debug.enabled || unlocked) return children

  const previous = CHALLENGE_ORDER[CHALLENGE_ORDER.indexOf(challenge) - 1]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-24 sm:px-8 sm:py-32">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-700">
        <Lock className="h-4 w-4 text-chalk-500" aria-hidden />
      </div>
      <SectionLabel>{challengeTitles[challenge]}</SectionLabel>
      <h1 className="text-3xl font-light tracking-[-0.025em] text-chalk-50 sm:text-4xl">
        Это испытание ещё закрыто
      </h1>
      <p className="text-sm leading-relaxed text-chalk-400">
        {previous
          ? `Сначала пройди «${challengeTitles[previous]}» — следующее откроется сразу после него.`
          : 'Начни с первого испытания.'}
      </p>
      <LinkButton
        to={previous ? challengeRoutes[previous] : '/play'}
        variant="primary"
        className="self-start"
      >
        {previous ? `К испытанию «${challengeTitles[previous]}»` : 'К испытаниям'}
      </LinkButton>
    </div>
  )
}
