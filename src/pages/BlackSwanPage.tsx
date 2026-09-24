import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import { getBlackSwanScenario, pickBlackSwanScenario } from '@/data/blackSwanScenarios'
import { BlackSwanGame } from '@/games/black-swan/BlackSwanGame'
import { BlackSwanResult } from '@/games/black-swan/BlackSwanResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { BlackSwanResult as SwanResult } from '@/types/game'

export function BlackSwanPage() {
  const debug = useDebugParams()
  const attempts = useGameStore((state) => state.attempts['black-swan'] ?? 0)
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<SwanResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const scenario = useMemo(
    () =>
      debug.scenario
        ? getBlackSwanScenario(debug.scenario)
        : pickBlackSwanScenario(attempts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debug.scenario],
  )

  useEffect(() => {
    trackEvent('black_swan_started', { scenarioId: scenario.id, seed: scenario.seed })
  }, [scenario])

  const handleComplete = (completed: SwanResult) => {
    const saved = saveResult({ challengeType: 'black-swan', result: completed })
    setResult(completed)
    setOutcome(saved)
    trackEvent('black_swan_completed', {
      scenarioId: completed.scenarioId,
      pnlPercent: Number(completed.pnlPercent.toFixed(2)),
      score: Math.round(completed.score),
      isPersonalBest: saved.isPersonalBest,
      seriesCompleted: saved.seriesCompleted,
    })
  }

  const content =
    result && outcome ? (
      <BlackSwanResult
        scenario={scenario}
        result={result}
        outcome={outcome}
        nextHref="/profile"
        nextLabel="Собрать мой профиль"
      />
    ) : (
      <BlackSwanGame
        scenario={scenario}
        timerDisabled={debug.timerDisabled}
        onComplete={handleComplete}
      />
    )

  return <ChallengeGate challenge="black-swan">{content}</ChallengeGate>
}
