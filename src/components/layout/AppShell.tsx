import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { ProgressDots } from '@/components/progress/ProgressDots'
import { LinkButton } from '@/components/ui/Button'
import { BrandMark } from './BrandMark'
import { ThemePanel } from './ThemePanel'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

const NAV_ITEMS = [
  { to: '/play', label: 'Испытания' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/profile', label: 'Профиль' },
]
const IMMERSIVE_ROUTES = ['/challenge/']

function Brand({ onClick }: { onClick?: () => void }) {
  return <Link to="/" onClick={onClick} className="trial-brand" aria-label="Market Trials — главная"><BrandMark /><span>MARKET TRIALS<span className="text-violet-accent">_</span></span></Link>
}

function SiteHeader({ immersive, currentChallenge }: { immersive: boolean; currentChallenge?: ChallengeType }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  // Accumulate 8px in one direction, and always show near the top.
  useEffect(() => {
    const getScrollY = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight))
    let previousY = getScrollY()
    let distance = 0
    const onScroll = () => {
      const currentY = getScrollY()
      const delta = currentY - previousY
      previousY = currentY
      if (currentY <= 88) {
        distance = 0
        setHidden(false)
        return
      }
      if (delta === 0) return
      distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta
      if (Math.abs(distance) >= 8) {
        setHidden(distance > 0)
        distance = 0
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [menuOpen])

  return (
    <header className={`trial-header${hidden && !menuOpen ? ' trial-header-hidden' : ''}`}>
      <div className="site-container header-row">
        <Brand onClick={() => setMenuOpen(false)} />
        {immersive ? (
          <div className="header-actions">
            <div className="hidden md:block"><ProgressDots current={currentChallenge} /></div>
            <Link to="/play" className="immersive-back micro-label text-chalk-400 hover:text-violet-accent">К испытаниям ↗</Link>
          </div>
        ) : <>
          <nav className="trial-nav" aria-label="Основная навигация">
            {NAV_ITEMS.map(item => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
          </nav>
          <div className="header-cta"><LinkButton to="/play" variant="primary">Войти в игру <span aria-hidden="true">↗</span></LinkButton></div>
          <button ref={menuButton} type="button" className="menu-toggle" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </>}
      </div>
      {!immersive && menuOpen && (
        <div id="mobile-navigation" className="mobile-navigation">
          <div className="site-container">
            <nav aria-label="Мобильная навигация">
              {NAV_ITEMS.map((item, index) => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}><span aria-hidden="true">0{index + 1}</span>{item.label}<span aria-hidden="true">↗</span></NavLink>)}
            </nav>
            <LinkButton to="/play" variant="primary" fullWidth onClick={() => setMenuOpen(false)}>Войти в игру <span aria-hidden="true">↗</span></LinkButton>
          </div>
        </div>
      )}
    </header>
  )
}

export function AppShell() {
  const location = useLocation()
  const immersive = IMMERSIVE_ROUTES.some(prefix => location.pathname.startsWith(prefix))
  const currentChallenge = CHALLENGE_ORDER.find(challenge => location.pathname.includes(challenge))

  useEffect(() => { trackEvent('game_opened', { path: window.location.pathname }) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <a className="skip-link" href="#main-content">К содержимому</a>
      <SiteHeader key={location.pathname} immersive={immersive} currentChallenge={currentChallenge} />
      <main id="main-content" className="flex-1" tabIndex={-1}><Outlet /></main>
      {!immersive && <SiteFooter />}
      {import.meta.env.DEV && <ThemePanel />}
      <DebugPanel />
    </div>
  )
}

function SiteFooter() {
  return <footer className="trial-footer"><div className="site-container">
    <div className="footer-grid"><div><Brand /><p className="mt-5 max-w-md text-sm leading-relaxed text-chalk-400">Четыре рынка. Четыре испытания.<br />Твой способ принимать решения.</p></div><nav aria-label="Об игре"><span className="micro-label text-chalk-500">[ MARKET TRIALS ]</span>{NAV_ITEMS.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav><nav aria-label="Компания"><span className="micro-label text-chalk-500">[ КОМПАНИЯ ]</span><Link to="/company">Компания ↗</Link><Link to="/team">Команда ↗</Link><Link to="/careers">Возможности ↗</Link></nav></div>
    <div className="footer-bottom"><p>Прототип · внутреннее тестирование. Результат описывает решения в игре и не является оценкой профессиональной квалификации.</p><span>МЫШЛЕНИЕ → ДЕЙСТВИЕ</span></div>
  </div></footer>
}
