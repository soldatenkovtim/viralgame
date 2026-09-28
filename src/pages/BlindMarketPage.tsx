import { selectScenario } from '@/modes/scenarios'
import { DuelResultShare } from '@/duel/DuelResultShare'
import { useEffect, useMemo, useState } from 'react'
import { BlindMarketGame } from '@/games/blind-market/BlindMarketGame'
import { BlindMarketResult } from '@/games/blind-market/BlindMarketResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { BlindMarketResult as BlindResult } from '@/types/game'

export function BlindMarketPage() {
  const mode = useGameStore(s => s.selectedMode) === 'advanced' ? 'advanced' : 'standard'
  const debug = useDebugParams()
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<BlindResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  // Сценарий фиксируется на весь раунд: при реплее он меняется, но не во время игры.
  const scenario = useMemo(() => {
    const state = useGameStore.getState()
    const attempt = mode === 'advanced' ? state.advancedResults.filter(r => r.challengeType === 'blind-market').length : state.attempts['blind-market'] ?? 0
    return selectScenario('blind-market', mode === 'advanced', attempt, debug.scenario)
  }, [debug.scenario, mode])

  useEffect(() => {
    if (mode === 'advanced') trackEvent('advanced_challenge_started', { challengeType: 'blind-market', scenarioId: scenario.id })
    trackEvent('blind_market_started', { scenarioId: scenario.id, seed: scenario.seed })
  }, [scenario, mode])

  const handleComplete = (completed: BlindResult) => {
    const saved = saveResult({ challengeType: 'blind-market', result: completed }, mode)
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
      <DuelResultShare payload={{ challengeType: 'blind-market', result }}>
      <BlindMarketResult
        scenario={scenario}
        result={result}
        outcome={outcome}
        nextHref="/challenge/market-maker"
        nextLabel="Открыть следующее испытание"
      />
      </DuelResultShare>
    )
  }

  return <BlindMarketGame context={{ mode, seed: scenario.seed }} scenario={scenario} onComplete={handleComplete} />
}
