import { useId, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { GameMode } from '@/modes/config'
import './ChallengeIntro.css'

export interface IntroStat { value: string | number; label: string }

const modeLabels: Record<GameMode, string> = {
  standard: 'Стандартный режим', advanced: 'Продвинутый режим', duel: 'Дуэль',
}

/** Presentation only: the game owns the scenario, stage and launch action. */
export function ChallengeIntro({ number, title, subtitle, description, stats, cta, visual,
  mode, state, onStart, note, howItWorks, className = '',
}: {
  number: string
  title: ReactNode
  subtitle: string
  description: string
  stats: IntroStat[]
  cta: string
  visual: ReactNode
  mode: GameMode
  state: 'intro'
  onStart: () => void
  howItWorks?: string[]
  className?: string
  note?: string
}) {
  const heading = useId()
  return <section className={`challenge-intro ${className}`} aria-labelledby={heading} data-mode={mode} data-state={state}>
    <div className="site-container challenge-intro-grid">
      <div className="challenge-intro-copy">
        <div className="challenge-intro-eyebrow">
          <span>{number} / 04 — ИСПЫТАНИЕ</span>
          <span className="challenge-intro-mode">{modeLabels[mode]}</span>
        </div>
        <h1 id={heading} className="hero-title challenge-intro-title">{title}<span className="challenge-intro-period">.</span></h1>
        <p className="challenge-intro-subtitle">{subtitle}</p>
        <p className="challenge-intro-description">{description}</p>
        {howItWorks && <section className="challenge-intro-how" aria-label="Как это работает">
          <h2>Как это работает</h2>
          <ol>{howItWorks.map(step => <li key={step}>{step}</li>)}</ol>
        </section>}
        <dl className="challenge-intro-stats">
          {stats.map(stat => <div key={stat.label}>
            <dt>{stat.label}</dt><dd>{stat.value}</dd>
          </div>)}
        </dl>
        <Button variant="primary" size="lg" className="challenge-intro-cta" onClick={onStart}>
          {cta}<ArrowUpRight size={20} aria-hidden="true" />
        </Button>
        {note && <p className="challenge-intro-note">{note}</p>}
      </div>
      {visual}
    </div>
  </section>
}
