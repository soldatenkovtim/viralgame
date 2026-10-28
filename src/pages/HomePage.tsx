import { ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HeroVisual } from '@/components/home/HeroVisual'
import { TrialsSection } from '@/components/home/TrialsSection'
import { LeaderboardSection } from '@/components/home/LeaderboardSection'
import { ProgressSection } from '@/components/home/ProgressSection'
import { gameEntry } from '@/lib/gameEntry'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import { useGameStore } from '@/store/gameStore'

export function HomePage() {
  const navigate = useNavigate()
  const state = useGameStore()
  const entry = gameEntry(state)

  const startGame = () => {
    trackEvent('game_started', { completed: state.completedChallenges.length })
    navigate(entry.to)
  }

  return (
    <div className="market-trials-home">
      <section className="trial-hero trial-hero-motion">
        <div className="site-container">
          <div className="hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">РЫНОЧНЫЙ<br />ВЫЗОВ<span className="text-violet-accent">.</span></h1>
              <p className="hero-manifesto">РЫНОК МЕНЯЕТСЯ. КАК РЕШИТЕ ВЫ?</p>
              <p className="hero-description">Четыре испытания. Непредсказуемые рыночные ситуации. Проверьте свои решения, набирайте очки и поборитесь за первое место в рейтинге.</p>
              <div className="hero-actions">
                <Button variant="primary" size="lg" onClick={startGame}>
                  ПРИНЯТЬ ВЫЗОВ
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <p className="hero-footnote">≈ 12 минут · Без регистрации</p>
            </div>
            <HeroVisual />
          </div>
        </div>
      </section>

      <TrialsSection />
      <LeaderboardSection />
      <ProgressSection />

    </div>
  )
}
