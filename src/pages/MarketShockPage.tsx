import { selectScenario } from '@/modes/scenarios'
import { DuelResultShare } from '@/duel/DuelResultShare'
import { useEffect, useMemo, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import { MarketShockGame } from '@/games/market-shock/MarketShockGame'
import { MarketShockResult } from '@/games/market-shock/MarketShockResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { MarketShockResult as ShockResult } from '@/types/game'

export function MarketShockPage() {
  const mode = useGameStore(s => s.selectedMode) === 'advanced' ? 'advanced' : 'standard'
  const debug = useDebugParams()
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<ShockResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const scenario = useMemo(() => {
    const state = useGameStore.getState()
    const attempt = mode === 'advanced' ? state.advancedResults.filter(r => r.challengeType === 'black-swan').length : state.attempts['black-swan'] ?? 0
    return selectScenario('black-swan', mode === 'advanced', attempt, debug.scenario)
  }, [debug.scenario, mode])

  useEffect(() => {
    if (mode === 'advanced') trackEvent('advanced_challenge_started', { challengeType: 'black-swan', scenarioId: scenario.id })
    trackEvent('black_swan_started', {
      scenarioId: scenario.id,
      seed: scenario.seed,
      pattern: scenario.pattern,
    })
  }, [scenario, mode])

  const handleComplete = (completed: ShockResult) => {
    const saved = saveResult({ challengeType: 'black-swan', result: completed }, mode)
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
      <DuelResultShare payload={{ challengeType: 'black-swan', result }}>
      <MarketShockResult
        scenario={scenario}
        result={result}
        outcome={outcome}
        nextHref="/challenge/cross-arbitrage"
        nextLabel="Открыть последнее испытание"
      />
      </DuelResultShare>
    ) : (
      <MarketShockGame
        context={{ mode, seed: scenario.seed }}
        scenario={scenario}
        timerDisabled={debug.timerDisabled}
        onComplete={handleComplete}
      />
    )

  return <ChallengeGate challenge="black-swan">{content}</ChallengeGate>
}
