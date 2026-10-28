import './ProgressSection.css'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { CHALLENGE_ORDER, challengeTitles, useGameStore } from '@/store/gameStore'
import { standardProgress } from './standardProgress'

export function ProgressSection() {
  const state = useGameStore()
  const progress = standardProgress(state)
  return <section id="progress" className="home-section home-progress" aria-labelledby="progress-heading">
    <div className="site-container">
      <div className="home-data-layout progress-summary">
        <div className="section-heading">
          <h2 id="progress-heading">Ваш прогресс</h2>
          <p>{progress.description}</p>
          <div className="progress-actions">
            <Link to={progress.to} className="content-link progress-primary"
              state={progress.next ? { trialMode: 'standard' } : undefined}
              onClick={() => { if (!progress.complete) state.setMode('standard') }}>
              {progress.action}<ArrowUpRight size={18} aria-hidden />
            </Link>
            {!progress.complete && <Link to="/profile" className="progress-profile">
              Открыть профиль<ArrowUpRight size={16} aria-hidden />
            </Link>}
          </div>
        </div>
        <div className="progress-meter">
          <div className="progress-count"><span>{progress.count} / {progress.total}</span> ИСПЫТАНИЙ</div>
          <div className="progress-segments" role="progressbar" aria-label="Стандартная серия"
            aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.count}
            aria-valuetext={`Пройдено ${progress.count} из ${progress.total} испытаний стандартной серии`}>
            {CHALLENGE_ORDER.map(challenge => <span key={challenge} aria-hidden
              data-complete={progress.completed.includes(challenge) || undefined} />)}
          </div>
          <p className="progress-current">{progress.complete
            ? state.advancedUnlocked ? 'Продвинутый режим открыт.' : 'Результаты серии доступны в вашем профиле.'
            : progress.next ? `Следующее испытание: ${challengeTitles[progress.next]}` : 'Доступные режимы — в карточках испытаний.'}</p>
          <p className="progress-local-note">Результаты завершённых испытаний сохраняются в вашем браузере.</p>
        </div>
      </div>
      <div className="progress-duel">
        <div><h3>Сравните свои решения</h3>
          <p>Попробуйте режим дуэли и сравните свои действия с другим участником.</p></div>
        <Link to="/play" className="content-link" onClick={() => state.setMode('duel')}>
          Перейти к дуэлям<ArrowUpRight size={18} aria-hidden />
        </Link>
      </div>
    </div>
  </section>
}
