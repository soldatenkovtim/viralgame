import { useGameStore, challengeRoutes } from '@/store/gameStore'
import { scenarioPool } from '@/scenario-engine/selectScenario'
import { trackEvent } from '@/lib/analytics'
import type { ChallengeType } from '@/types/game'
import { Button } from '@/components/ui/Button'
/** Render only on the normal result page; duel invitations keep their fixed market. */
export function ScenarioReplay({ challengeType, scenarioId }: { challengeType: ChallengeType; scenarioId: string }) {
  const mode = useGameStore(s => s.selectedMode) === 'advanced' ? 'advanced' : 'standard'
  const progress = useGameStore(s => (mode === 'advanced' ? s.advancedScenarioProgress : s.scenarioProgress)[challengeType])
  const pool = scenarioPool(challengeType, mode)
  const completed = pool.filter(s => progress.completedScenarioIds.includes(s.id)).length
  const remaining = pool.length - completed
  return <div className="mx-auto mb-12 max-w-5xl flex flex-col items-start gap-3 rounded-xl border border-ink-700 p-5 text-sm text-chalk-400">
    <p>Ты прошёл {completed} из {pool.length} сценариев этого испытания.</p>
    <p>{remaining ? `Доступно ещё ${remaining} сценария` : 'Все сценарии этого испытания пройдены'}</p>
    <Button variant="secondary" onClick={() => {
      trackEvent('alternate_scenario_clicked', { challengeType, scenarioId, mode })
      const params = new URLSearchParams(window.location.search)
      params.delete('scenario')
      window.location.assign(`${challengeRoutes[challengeType]}${params.size ? `?${params}` : ''}`)
    }}>{remaining ? 'Попробовать другой сценарий' : 'Сыграть случайный сценарий'}</Button>
  </div>
}
