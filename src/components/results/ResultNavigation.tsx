import { Link } from 'react-router-dom'

export function ResultNavigation() {
  return <nav className="result-navigation" aria-label="После испытания">
    <Link to="/#trials">Другие испытания <span aria-hidden>↗</span></Link>
    <Link to="/leaderboard">Смотреть рейтинг <span aria-hidden>↗</span></Link>
    <Link to="/profile">Мой прогресс <span aria-hidden>↗</span></Link>
  </nav>
}
