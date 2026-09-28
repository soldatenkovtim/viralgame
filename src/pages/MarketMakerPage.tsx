import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import {
  getMarketMakerScenario,
  pickMarketMakerScenario,
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

  // Смена потока раскрывается только в replay. Номер попытки читается один раз,
  // чтобы сохранение результата не подменило сценарий на экране итогов.
  const scenario = useMemo(
    () =>
      debug.scenario
        ? getMarketMakerScenario(debug.scenario)
        : pickMarketMakerScenario(useGameStore.getState().attempts['market-maker'] ?? 0),
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
      pnl: Math.round(completed.pnl),
      spreadPnl: Math.round(completed.spreadPnl),
      inventoryPnl: Math.round(completed.inventoryPnl),
      hedgeCosts: Math.round(completed.hedgeCosts),
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
        nextLabel="Открыть следующее испытание"
      />
    ) : (
      <MarketMakerGame scenario={scenario} onComplete={handleComplete} />
    )

  return <ChallengeGate challenge="market-maker">{content}</ChallengeGate>
}
