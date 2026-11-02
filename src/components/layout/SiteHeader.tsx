import { Link, useLocation } from 'react-router-dom'
import { LinkButton } from '@/components/ui/Button'
import { BrandMark } from './BrandMark'
import { useGameStore } from '@/store/gameStore'
import { gameEntry } from '@/lib/gameEntry'

export function Brand() {
  return <Link to="/" className="trial-brand" aria-label="Рыночный вызов — главная"><BrandMark /><span>РЫНОЧНЫЙ ВЫЗОВ<span className="text-violet-accent">_</span></span></Link>
}

export function SiteHeader() {
  const state = useGameStore()
  const location = useLocation()
  const entry = location.pathname === '/profile' && state.completedChallenges.length === 4
    ? { to: '/#trials', label: 'Другие сценарии' } : gameEntry(state)
  const home = location.pathname === '/'
  return <header className={`trial-header${home ? ' trial-header-home' : ''}`}><div className="site-container header-row">
    <Brand />
    {!home && <LinkButton to={entry.to} variant="primary" className="header-start">{entry.label}<span aria-hidden>↗</span></LinkButton>}
  </div></header>
}
