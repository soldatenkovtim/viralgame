import { Link } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import { CHALLENGE_ORDER, challengeNumbers, challengeTitles, useGameStore } from '@/store/gameStore'
import { formatNumber } from '@/lib/formatting'
import { MyRooms } from '@/duel/MyRooms'

export function ProgressSection() {
  const state = useGameStore()
  return <section className="home-section" aria-labelledby="progress-heading"><div className="site-container">
    <div className="home-data-layout">
      <div className="section-heading">
        <h2 id="progress-heading">Мой прогресс</h2>
        {state.tradingProfile && <p>{state.tradingProfile.archetype}</p>}
        <p className="progress-storage">Результаты сохраняются в этом браузере. Регистрация не нужна. Незавершённый раунд при выходе начинается заново.</p>
        <Link to="/profile" className="content-link">Открыть профиль <ArrowUpRight size={18} aria-hidden /></Link>
      </div>
      <div className="progress-ledger">
        <div className="data-strip"><span>СТАНДАРТНАЯ СЕРИЯ</span><span>{state.completedChallenges.length} / {CHALLENGE_ORDER.length}</span></div>
        <ol>{CHALLENGE_ORDER.map(challenge => <li key={challenge}>
          <span className="text-chalk-500">{challengeNumbers[challenge]}</span>
          <span>{challengeTitles[challenge]}</span>
          <span className="progress-score">{state.completedChallenges.includes(challenge) ? <><Check size={14} aria-hidden /><span className="sr-only">Пройдено. </span>{state.personalBests[challenge] !== undefined ? `${formatNumber(state.personalBests[challenge])} очк.` : 'Пройдено'}</> : 'Не пройдено'}</span>
        </li>)}</ol>
        <div className="data-note progress-extra"><span>Продвинутый: {new Set(state.advancedResults.map(result => result.challengeType)).size} / 4</span><span>Дуэлей завершено: {state.duelHistory.length}</span></div>
      </div>
    </div>
    <MyRooms />
  </div></section>
}
