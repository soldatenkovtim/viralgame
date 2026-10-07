import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { ProgressDots } from '@/components/progress/ProgressDots'
import { BrandMark } from './BrandMark'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER } from '@/store/gameStore'

const NAV_ITEMS = [
  { to: '/play', label: 'Испытания' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/profile', label: 'Профиль' },
]
const IMMERSIVE_ROUTES = ['/challenge/']

function Brand() {
  return <Link to="/" className="trial-brand" aria-label="Market Trials — главная"><BrandMark /><span>MARKET TRIALS<span className="text-violet-accent">_</span><small>BY EXELSIOR</small></span></Link>
}

export function AppShell() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const immersive = IMMERSIVE_ROUTES.some((prefix) => location.pathname.startsWith(prefix))
  const currentChallenge = CHALLENGE_ORDER.find((challenge) => location.pathname.includes(challenge))

  useEffect(() => { trackEvent('game_opened', { path: window.location.pathname }) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <a className="skip-link" href="#main-content">К содержимому</a>
      <header className="trial-header">
        <div className="site-container header-row">
          <Brand />
          {immersive ? <div className="flex items-center gap-4"><div className="hidden md:block"><ProgressDots current={currentChallenge} /></div><Link to="/play" className="micro-label text-chalk-400 hover:text-violet-accent">К испытаниям ↗</Link></div> : <>
            <nav className="trial-nav" aria-label="Основная навигация">{NAV_ITEMS.map(item => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}</nav>
            <Link className="header-cta" to="/play">Войти в игру <span aria-hidden>↗</span></Link>
            <button type="button" className="menu-toggle" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}</button>
          </>}
        </div>
        {!immersive && menuOpen && <nav id="mobile-navigation" className="mobile-navigation site-container" aria-label="Мобильная навигация">{NAV_ITEMS.map(item => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}<span aria-hidden>↗</span></NavLink>)}</nav>}
      </header>
      <main id="main-content" className="flex-1" tabIndex={-1}><Outlet /></main>
      {!immersive && <SiteFooter />}
      <DebugPanel />
    </div>
  )
}

function SiteFooter() {
  return <footer className="trial-footer"><div className="site-container">
    <div className="footer-grid"><div><Brand /><p className="mt-5 max-w-md text-sm leading-relaxed text-chalk-400">Четыре рынка. Четыре испытания.<br />Твой способ принимать решения.</p></div><nav aria-label="Об игре"><span className="micro-label text-chalk-500">[ MARKET TRIALS ]</span>{NAV_ITEMS.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav><nav aria-label="Компания"><span className="micro-label text-chalk-500">[ EXELSIOR ]</span><Link to="/company">Компания ↗</Link><Link to="/team">Команда ↗</Link><Link to="/careers">Возможности ↗</Link></nav></div>
    <div className="footer-bottom"><p>Прототип · внутреннее тестирование. Результат описывает решения в игре и не является оценкой профессиональной квалификации.</p><span>МЫШЛЕНИЕ → ДЕЙСТВИЕ</span></div>
  </div></footer>
}
