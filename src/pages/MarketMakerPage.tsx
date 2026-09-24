import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import {
  getMarketMakerScenario,
  pickRandomMarketMakerScenario,
} from '@/data/marketMakerScenarios'
import { MarketMakerGame } from '@/games/market-maker/MarketMakerGame'
import { MarketMakerResult } from '@/games/market-maker/MarketMakerResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { MarketMakerResult as MMResult } from '@/types/game'

export function MarketMakerPage() {
  const debug = useDebugParams()
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<MMResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  // Тип контрагента выбирается случайно и не показывается до конца раунда.
  const scenario = useMemo(
    () =>
      debug.scenario
        ? getMarketMakerScenario(debug.scenario)
        : pickRandomMarketMakerScenario(),
    [debug.scenario],
  )

  useEffect(() => {
    trackEvent('market_maker_started', { scenarioId: scenario.id, seed: scenario.seed })
  }, [scenario])

  const handleComplete = (completed: MMResult) => {
    const saved = saveResult({ challengeType: 'market-maker', result: completed })
    setResult(completed)
    setOutcome(saved)
    trackEvent('market_maker_completed', {
      scenarioId: completed.scenarioId,
      botType: completed.botType,
      pnl: Math.round(completed.pnl),
      score: Math.round(completed.score),
      isPersonalBest: saved.isPersonalBest,
    })
  }

  const content =
    result && outcome ? (
      <MarketMakerResult
        result={result}
        outcome={outcome}
        nextHref="/challenge/black-swan"
        nextLabel="Открыть последнее испытание"
      />
    ) : (
      <MarketMakerGame scenario={scenario} onComplete={handleComplete} />
    )

  return <ChallengeGate challenge="market-maker">{content}</ChallengeGate>
}
