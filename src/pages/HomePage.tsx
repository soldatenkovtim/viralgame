import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { MarketStructure } from '@/components/home/MarketStructure'
import { ChallengeCard } from '@/components/ui/ChallengeCard'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import { ChallengeCounter } from '@/components/progress/ProgressDots'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'

export function HomePage() {
  const navigate = useNavigate()
  const completed = useGameStore((state) => state.completedChallenges)
  const unlocked = useGameStore((state) => state.unlockedChallenges)
  const personalBests = useGameStore((state) => state.personalBests)

  const startGame = () => {
    trackEvent('game_started', { completed: completed.length })
    navigate(completed.length > 0 ? '/play' : '/challenge/blind-market')
  }

  return (
    <div className="exelsior-home">
      <section className="trial-hero">
        <div className="site-container">
          <div className="hero-topline"><span>[ EXELSIOR / MARKET TRIALS ]</span><span>МЫШЛЕНИЕ. РЕШЕНИЯ. РЫНОК.</span></div>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="micro-label mb-6 text-chalk-500">ЧЕТЫРЕ РЫНКА / ТВОЙ ПОДХОД</p>
              <h1 className="hero-title">MARKET<br />TRIALS<span className="text-violet-accent">.</span></h1>
              <p className="hero-manifesto">РЫНОК МЕНЯЕТСЯ. КАК РЕШИШЬ ТЫ?</p>
              <p className="hero-description">Четыре разных испытания. Посмотрим, как ты принимаешь решения, когда правильного ответа заранее нет.</p>
              <div className="hero-actions">
                <Button variant="primary" size="lg" onClick={startGame}>
                  {completed.length > 0 ? 'Продолжить испытания' : 'Начать испытания'}
                  <ArrowUpRight className="ml-4 h-5 w-5 text-lime" aria-hidden />
                </Button>
                <ChallengeCounter />
              </div>
              <p className="hero-footnote"><span aria-hidden>[ + ]</span>Без регистрации. Около 12 минут.<br />Только ты, информация и твои решения.</p>
            </div>
            <MarketStructure />
          </div>
          <div className="hero-bottomline"><span>ИНФОРМАЦИЯ → РЕШЕНИЕ → РЕЗУЛЬТАТ</span><a href="#trials">ВЫБРАТЬ ИСПЫТАНИЕ <ArrowDown className="h-4 w-4 text-violet-accent" aria-hidden /></a></div>
        </div>
      </section>

      <section id="trials" className="home-section">
        <div className="site-container">
          <div className="section-heading"><p className="micro-label text-violet-accent">[ 01 / ИСПЫТАНИЯ ]</p><h2>Один рынок.<br className="sm:hidden" /> Разные решения.</h2><p>От первого сигнала до рыночного шока — пройди всю серию.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGE_ORDER.map((challenge) => <ChallengeCard key={challenge} challenge={challenge} locked={!unlocked.includes(challenge)} completed={completed.includes(challenge)} bestPoints={personalBests[challenge]} />)}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="site-container">
          <div className="section-heading"><p className="micro-label text-violet-accent">[ 02 / КАК ЭТО РАБОТАЕТ ]</p><h2>Твой подход в действии.</h2></div>
          <div className="trial-process">
            <HowItWorks number="01" step="Принимай решения" text="Направление, размер, уверенность — вся сложность в самом решении." />
            <HowItWorks number="02" step="Следи за рынком" text="Рынок развивается. Новая информация появляется, и позицию приходится пересматривать." />
            <HowItWorks number="03" step="Собери свой профиль" text="Узнай, что твои решения говорят о твоём подходе внутри этой игровой сессии." />
            <HowItWorks number="04" step="Сравни с другом" text="Отправь тот же рынок другому трейдеру. Посмотрите, кто и как воспользовался возможностью." />
          </div>
        </div>
      </section>

      <section className="site-container py-12 sm:py-16">
        <div className="trial-invite">
          <div><p className="micro-label mb-5">[ ОДИН РЫНОК / ДВА ТРЕЙДЕРА ]</p><h2>Одинаковые условия.<br /><span>Твой выбор.</span></h2></div>
          <div><p>Пройди испытания самостоятельно или выбери режим дуэли и пригласи другого трейдера.</p><Link to="/play" className="invite-link">К испытаниям <ArrowUpRight className="h-5 w-5" aria-hidden /></Link></div>
        </div>
      </section>
    </div>
  )
}

function HowItWorks({ number, step, text }: { number: string; step: string; text: string }) {
  return <div><div className="process-number"><span>[ {number} ]</span><span aria-hidden>↗</span></div><h3>{step}</h3><p>{text}</p></div>
}
