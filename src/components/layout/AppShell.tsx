import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { ProgressDots } from '@/components/progress/ProgressDots'
import { trackEvent } from '@/lib/analytics'
import { CHALLENGE_ORDER } from '@/store/gameStore'

const NAV_ITEMS = [
  { to: '/play', label: 'Испытания' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/profile', label: 'Профиль' },
]

/** На игровых экранах навигация убирается, чтобы не отвлекать от решения. */
const IMMERSIVE_ROUTES = ['/challenge/']

export function AppShell() {
  const location = useLocation()
  const immersive = IMMERSIVE_ROUTES.some((prefix) => location.pathname.startsWith(prefix))
  const currentChallenge = CHALLENGE_ORDER.find((challenge) =>
    location.pathname.includes(challenge),
  )

  useEffect(() => {
    trackEvent('game_opened', { path: window.location.pathname })
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link
            to="/"
            className="text-sm font-medium tracking-[0.22em] text-chalk-50 uppercase"
          >
            Market Trials
          </Link>

          {immersive ? (
            <div className="flex items-center gap-4 sm:gap-5">
              <ProgressDots current={currentChallenge} />
              <Link
                to="/play"
                className="shrink-0 text-xs text-chalk-500 transition-colors hover:text-chalk-200"
              >
                К испытаниям
              </Link>
            </div>
          ) : (
            <nav className="flex items-center gap-1 sm:gap-2">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'text-chalk-50'
                        : 'text-chalk-500 hover:text-chalk-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {!immersive ? <SiteFooter /> : null}

      <DebugPanel />
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-10 text-xs text-chalk-500 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <p className="max-w-lg leading-relaxed">
          Market Trials — прототип. Рыночные данные стилизованы и используются
          исключительно для тестирования игровой механики. Результат не является
          оценкой профессиональной квалификации.
        </p>
        <nav className="flex gap-5">
          <Link to="/company" className="transition-colors hover:text-chalk-200">
            Компания
          </Link>
          <Link to="/team" className="transition-colors hover:text-chalk-200">
            Команда
          </Link>
          <Link to="/careers" className="transition-colors hover:text-chalk-200">
            Возможности
          </Link>
        </nav>
      </div>
    </footer>
  )
}
