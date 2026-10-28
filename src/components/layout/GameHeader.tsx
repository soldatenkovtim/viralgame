import { Link } from 'react-router-dom'
import { challengeNumbers, challengeTitles } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

export function GameHeader({ challenge }: { challenge?: ChallengeType }) {
  return <header className="game-header"><nav className="site-container game-header-row" aria-label="Навигация испытания">
    <Link to="/#trials" className="game-back"><span aria-hidden>←</span> Назад к испытаниям</Link>
    <span className="game-caption">{challenge ? `${challengeNumbers[challenge]} / ${challengeTitles[challenge]}` : 'РЫНОЧНЫЙ ВЫЗОВ / ДУЭЛЬ'}</span>
  </nav></header>
}
