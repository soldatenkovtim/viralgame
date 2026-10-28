import './TrialsSection.css'
import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { nextTrial } from './trialState'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function TrialsSection() {
  const state = useGameStore()
  const featured = nextTrial(state)
  return <section id="trials" className="home-section" aria-labelledby="trials-heading">
    <div className="site-container">
      <div className="section-heading">
        <h2 id="trials-heading">Испытания</h2>
        <p>Четыре испытания — четыре разных рыночных сценария. Принимайте решения, получайте результаты и проверяйте свой подход в разных условиях.</p>
      </div>
      <div className="trial-selection-grid">
        {CHALLENGE_ORDER.map(challenge => <ChallengeCard key={challenge} challenge={challenge}
          featured={challenge === featured} />)}
      </div>
    </div>
  </section>
}
