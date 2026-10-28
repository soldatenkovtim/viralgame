import { useNavigate } from 'react-router-dom'
import { TrialsSection } from '@/components/home/TrialsSection'
import { Button, LinkButton } from '@/components/ui/Button'
import { MyRooms } from '@/duel/MyRooms'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'
import { trackEvent } from '@/lib/analytics'

export function PlayPage() {
  const state = useGameStore()
  const navigate = useNavigate()
  return <>
    <div className="site-container pt-10"><h1 className="micro-label text-chalk-400">ВЫБОР ИСПЫТАНИЯ</h1></div>
    <TrialsSection />
    <div className="site-container py-10"><MyRooms />
      <div className="flex flex-wrap gap-4">
        {state.completedChallenges.length === CHALLENGE_ORDER.length && <Button onClick={() => {
          trackEvent('series_restarted', { from: 'play' })
          state.restartSeries()
          navigate('/challenge/blind-market')
        }}>Пройти серию заново</Button>}
        <LinkButton to="/profile">Мой прогресс</LinkButton>
        <LinkButton to="/leaderboard">Смотреть рейтинг <span aria-hidden>↗</span></LinkButton>
      </div>
    </div>
  </>
}
