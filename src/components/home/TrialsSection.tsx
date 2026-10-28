import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function TrialsSection() {
  const state = useGameStore()
  const advanced = state.selectedMode === 'advanced'
  const completed = advanced ? state.advancedResults.map(result => result.challengeType) : state.completedChallenges
  return <section id="trials" className="home-section" aria-labelledby="trials-heading">
    <div className="site-container">
      <div className="section-heading">
        <h2 id="trials-heading">Испытания</h2>
        <p>Выберите испытание, затем режим. Стандартная серия открывается шаг за шагом.</p>
      </div>
      <div className="trial-selection-grid">
        {CHALLENGE_ORDER.map(challenge => <ChallengeCard key={challenge} challenge={challenge}
          locked={state.selectedMode === 'duel' ? false : advanced ? !state.advancedUnlocked : !state.unlockedChallenges.includes(challenge)}
          completed={state.selectedMode !== 'duel' && completed.includes(challenge)}
          bestPoints={state.selectedMode === 'duel' ? undefined : (advanced ? state.advancedBests : state.personalBests)[challenge]} />)}
      </div>
    </div>
  </section>
}
