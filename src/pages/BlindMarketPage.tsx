import { useEffect, useMemo, useState } from 'react'
import { getBlindScenario, pickBlindScenario } from '@/data/blindMarketScenarios'
import { BlindMarketGame } from '@/games/blind-market/BlindMarketGame'
import { BlindMarketResult } from '@/games/blind-market/BlindMarketResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { BlindMarketResult as BlindResult } from '@/types/game'

export function BlindMarketPage() {
  const debug = useDebugParams()
  const attempts = useGameStore((state) => state.attempts['blind-market'] ?? 0)
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<BlindResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  // Сценарий фиксируется на весь раунд: при реплее он меняется, но не во время игры.
  const scenario = useMemo(
    () => (debug.scenario ? getBlindScenario(debug.scenario) : pickBlindScenario(attempts)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debug.scenario],
  )

  useEffect(() => {
    trackEvent('blind_market_started', { scenarioId: scenario.id, seed: scenario.seed })
  }, [scenario])

  const handleComplete = (completed: BlindResult) => {
    const saved = saveResult({ challengeType: 'blind-market', result: completed })
    setResult(completed)
    setOutcome(saved)
    trackEvent('blind_market_completed', {
      scenarioId: completed.scenarioId,
      pnlPercent: Number(completed.pnlPercent.toFixed(2)),
      score: Math.round(completed.score),
      isPersonalBest: saved.isPersonalBest,
    })
  }

  if (result && outcome) {
    return (
      <BlindMarketResult
        scenario={scenario}
        result={result}
        outcome={outcome}
        nextHref="/challenge/market-maker"
        nextLabel="Открыть следующее испытание"
      />
    )
  }

  return <BlindMarketGame scenario={scenario} onComplete={handleComplete} />
}
