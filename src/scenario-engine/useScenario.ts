import { useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { selectScenario } from './selectScenario'
import { trackEvent } from '@/lib/analytics'
import type { ChallengeType } from '@/types/game'
import type { ScenarioMode } from './scenarioTypes'
/** Freeze selection for this mounted attempt, even after completion updates persisted history. */
export function useScenario<T extends ChallengeType>(type: T, mode: ScenarioMode, debugId?: string | null) {
  const unlocked = useGameStore(s => s.unlockedChallenges.includes(type) || mode === 'advanced')
  const scenario = useMemo(() => {
    const state = useGameStore.getState()
    const progress = (mode === 'standard' ? state.scenarioProgress : state.advancedScenarioProgress)[type]
    return selectScenario(type, mode, progress.seenScenarioIds, debugId, progress.lastScenarioId)
  }, [type, mode, debugId])
  const tracked = useRef('')
  useEffect(() => {
    const key = `${type}/${mode}/${scenario.id}`
    if (!unlocked || tracked.current === key) return
    tracked.current = key
    const state = useGameStore.getState()
    const progress = (mode === 'standard' ? state.scenarioProgress : state.advancedScenarioProgress)[type]
    const payload = { challengeType: type, scenarioId: scenario.id, mode }
    trackEvent('scenario_selected', payload)
    if (progress.completedScenarioIds.length) trackEvent('scenario_replayed', payload)
    state.markScenarioStarted(type, scenario.id, mode)
  }, [type, mode, scenario.id, unlocked])
  return scenario
}
