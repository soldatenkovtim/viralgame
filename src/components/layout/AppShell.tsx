import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { Brand, SiteHeader } from './SiteHeader'
import { GameHeader } from './GameHeader'
import { ThemePanel } from './ThemePanel'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER } from '@/store/gameStore'

const FOOTER_LINKS = [
  { to: '/#trials', label: 'Испытания' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/profile', label: 'Профиль' },
]

export function AppShell() {
  const location = useLocation()
  const immersive = ['/challenge/', '/duel/'].some(prefix => location.pathname.startsWith(prefix))
  const currentChallenge = CHALLENGE_ORDER.find(challenge => location.pathname.split('/').includes(challenge))

  useEffect(() => { trackEvent('game_opened', { path: window.location.pathname }) }, [])
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [location.pathname, location.hash, location.key])

  return <div className="flex min-h-dvh flex-col bg-ink-950">
    <a className="skip-link" href="#main-content">К содержимому</a>
    {immersive ? <GameHeader challenge={currentChallenge} /> : <SiteHeader />}
    <main id="main-content" className="flex-1" tabIndex={-1}><Outlet /></main>
    {!immersive && <SiteFooter home={location.pathname === '/'} />}
    {import.meta.env.DEV && location.pathname !== '/' && <ThemePanel />}
    <DebugPanel />
  </div>
}

function SiteFooter({ home }: { home: boolean }) {
  if (home) return <footer className="trial-footer home-footer"><div className="site-container">
    <Brand />
    <nav aria-label="Об игре">{FOOTER_LINKS.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav>
    <nav aria-label="Компания"><Link to="/company">Компания</Link><Link to="/team">Команда</Link><Link to="/careers">Возможности</Link></nav>
    <p>Прототип · внутреннее тестирование. Результат описывает решения в игре и не является оценкой профессиональной квалификации.</p>
    {import.meta.env.DEV && <ThemePanel inline />}
  </div></footer>
  return <footer className="trial-footer"><div className="site-container">
    <div className="footer-grid"><div><Brand /><p className="mt-5 max-w-md text-sm leading-relaxed text-chalk-400">Четыре рынка. Четыре испытания.<br />Ваш способ принимать решения.</p></div><nav aria-label="Об игре"><span className="micro-label text-chalk-500">[ РЫНОЧНЫЙ ВЫЗОВ ]</span>{FOOTER_LINKS.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav><nav aria-label="Компания"><span className="micro-label text-chalk-500">[ КОМПАНИЯ ]</span><Link to="/company">Компания ↗</Link><Link to="/team">Команда ↗</Link><Link to="/careers">Возможности ↗</Link></nav></div>
    <div className="footer-bottom"><p>Прототип · внутреннее тестирование. Результат описывает решения в игре и не является оценкой профессиональной квалификации.</p><span>МЫШЛЕНИЕ → ДЕЙСТВИЕ</span></div>
  </div></footer>
}
