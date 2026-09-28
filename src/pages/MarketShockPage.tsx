import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import { MarketShockGame } from '@/games/market-shock/MarketShockGame'
import { MarketShockResult } from '@/games/market-shock/MarketShockResult'
import { getMarketShockScenario, pickMarketShockScenario } from '@/games/market-shock/scenarios'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { MarketShockResult as ShockResult } from '@/types/game'

export function MarketShockPage() {
  const debug = useDebugParams()
  const attempts = useGameStore((state) => state.attempts['black-swan'] ?? 0)
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<ShockResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const scenario = useMemo(
    () =>
      debug.scenario
        ? getMarketShockScenario(debug.scenario)
        : pickMarketShockScenario(attempts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debug.scenario],
  )

  useEffect(() => {
    trackEvent('black_swan_started', {
      scenarioId: scenario.id,
      seed: scenario.seed,
      pattern: scenario.pattern,
    })
  }, [scenario])

  const handleComplete = (completed: ShockResult) => {
    const saved = saveResult({ challengeType: 'black-swan', result: completed })
    setResult(completed)
    setOutcome(saved)
    trackEvent('black_swan_completed', {
      scenarioId: completed.scenarioId,
      pattern: completed.pattern,
      pnlPercent: Number(completed.pnlPercent.toFixed(2)),
      maxDrawdown: Number(completed.maxDrawdown.toFixed(2)),
      levels: completed.levels.length,
      score: Math.round(completed.score),
      isPersonalBest: saved.isPersonalBest,
      seriesCompleted: saved.seriesCompleted,
    })
  }

  const content =
    result && outcome ? (
      <MarketShockResult
        scenario={scenario}
        result={result}
        outcome={outcome}
        nextHref="/challenge/cross-arbitrage"
        nextLabel="Открыть последнее испытание"
      />
    ) : (
      <MarketShockGame
        scenario={scenario}
        timerDisabled={debug.timerDisabled}
        onComplete={handleComplete}
      />
    )

  return <ChallengeGate challenge="black-swan">{content}</ChallengeGate>
}
