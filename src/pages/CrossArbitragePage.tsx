import { useScenario } from '@/scenario-engine/useScenario'
import { ScenarioReplay } from '@/components/results/ScenarioReplay'
import { DuelResultShare } from '@/duel/DuelResultShare'
import { useEffect, useState } from 'react'
import { ChallengeGate } from '@/components/layout/ChallengeGate'
import { CrossArbitrageGame } from '@/games/cross-arbitrage/CrossArbitrageGame'
import { CrossArbitrageResult } from '@/games/cross-arbitrage/CrossArbitrageResult'
import { useDebugParams } from '@/hooks/useDebug'
import { trackEvent } from '@/lib/analytics'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { CrossArbitrageResult as ArbResult } from '@/types/game'

export function CrossArbitragePage() {
  const mode = useGameStore(s => s.selectedMode) === 'advanced' ? 'advanced' : 'standard'
  const debug = useDebugParams()
  const saveResult = useGameStore((state) => state.saveResult)

  const [result, setResult] = useState<ArbResult | null>(null)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  const session = useScenario('cross-arbitrage', mode, debug.scenario)

  useEffect(() => {
    if (mode === 'advanced') trackEvent('advanced_challenge_started', { challengeType: 'cross-arbitrage', scenarioId: session.id })
    trackEvent('cross_arbitrage_started', { sessionId: session.id, seed: session.seed })
  }, [session, mode])

  const handleComplete = (completed: ArbResult) => {
    const saved = saveResult({ challengeType: 'cross-arbitrage', result: completed }, mode)
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
      <DuelResultShare payload={{ challengeType: 'cross-arbitrage', result }}>
      <CrossArbitrageResult
        session={session}
        result={result}
        outcome={outcome}
        nextHref={mode === 'advanced' ? '/play' : '/profile'}
        nextLabel={mode === 'advanced' ? 'Результаты режимов' : 'Собрать мой профиль'}
      />
      <ScenarioReplay challengeType="cross-arbitrage" scenarioId={session.id} />
      </DuelResultShare>
    ) : (
      <CrossArbitrageGame key={session.id}
        context={{ mode, seed: session.seed }}
        session={session}
        timerDisabled={debug.timerDisabled}
        onComplete={handleComplete}
      />
    )

  return <ChallengeGate challenge="cross-arbitrage">{content}</ChallengeGate>
}
