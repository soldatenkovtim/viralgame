import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import {
  getCrossArbitrageSession,
  pickCrossArbitrageSession,
} from '@/data/crossArbitrageScenarios'
import { CrossArbitrageGame } from '@/games/cross-arbitrage/CrossArbitrageGame'
import { CrossArbitrageResult } from '@/games/cross-arbitrage/CrossArbitrageResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { CrossArbitrageResult as ArbResult } from '@/types/game'

export function CrossArbitragePage() {
  const debug = useDebugParams()
  const attempts = useGameStore((state) => state.attempts['cross-arbitrage'] ?? 0)
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<ArbResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const session = useMemo(
    () =>
      debug.scenario
        ? getCrossArbitrageSession(debug.scenario)
        : pickCrossArbitrageSession(attempts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debug.scenario],
  )

  useEffect(() => {
    trackEvent('cross_arbitrage_started', { sessionId: session.id, seed: session.seed })
  }, [session])

  const handleComplete = (completed: ArbResult) => {
    const saved = saveResult({ challengeType: 'cross-arbitrage', result: completed })
    setResult(completed)
    setOutcome(saved)
    trackEvent('cross_arbitrage_completed', {
      sessionId: completed.scenarioId,
      totalReturnPercent: Number(completed.totalReturnPercent.toFixed(3)),
      found: completed.found,
      falseTrades: completed.falseTrades,
      missed: completed.missed,
      score: Math.round(completed.score),
      isPersonalBest: saved.isPersonalBest,
      seriesCompleted: saved.seriesCompleted,
    })
  }

  const content =
    result && outcome ? (
      <CrossArbitrageResult
        session={session}
        result={result}
        outcome={outcome}
        nextHref="/profile"
        nextLabel="Собрать мой профиль"
      />
    ) : (
      <CrossArbitrageGame
        session={session}
        timerDisabled={debug.timerDisabled}
        onComplete={handleComplete}
      />
    )

  return <ChallengeGate challenge="cross-arbitrage">{content}</ChallengeGate>
}
