import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { CHALLENGE_ORDER, useGameStore } from '@/store/gameStore'
import { formatNumber } from '@/lib/formatting'

export function LeaderboardSection() {
  const state = useGameStore()
  const complete = state.completedChallenges.length === CHALLENGE_ORDER.length
  return <section className="home-section" aria-labelledby="ranking-heading"><div className="site-container home-data-layout">
    <div className="section-heading">
      <h2 id="ranking-heading">Рейтинг участников</h2>
      <p>Сравните свои результаты с другими участниками и поборитесь за место среди лидеров.</p>
      <Link to="/leaderboard" className="content-link">Смотреть рейтинг <ArrowUpRight size={18} aria-hidden /></Link>
    </div>
    <div className="ranking-preview">
      <div className="data-strip"><span>ЛОКАЛЬНЫЙ РЕЗУЛЬТАТ</span></div>
      {complete ? <div className="ranking-person"><div><h3>{state.playerName || 'Вы'}</h3><p>{state.tradingProfile?.archetype}</p></div><strong>{formatNumber(state.bestOverallScore())}<small>ОЧКОВ</small></strong></div>
        : <div className="ranking-empty"><p>Ваш результат появится после четырёх испытаний.</p></div>}
      <p className="data-note">Общий рейтинг пока не подключён. Здесь доступны только результаты на этом устройстве. Сравнить решения с другим участником можно в дуэли.</p>
    </div>
  </div></section>
}
