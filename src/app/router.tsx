import { ModeBoundary } from '@/modes/ModeSelector'
import { RoomPage } from '@/duel/RoomPage'
import { DuelLanding } from '@/duel/DuelLanding'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { MarketShockPage } from '@/pages/MarketShockPage'
import { BlindMarketPage } from '@/pages/BlindMarketPage'
import { CareersPage } from '@/pages/CareersPage'
import { CompanyPage, TeamPage } from '@/pages/CompanyPage'
import { CrossArbitragePage } from '@/pages/CrossArbitragePage'
import { HomePage } from '@/pages/HomePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { MarketMakerPage } from '@/pages/MarketMakerPage'
import { PlayPage } from '@/pages/PlayPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SharedChallengePage } from '@/pages/SharedChallengePage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />

          <Route path="/challenge/blind-market" element={<ModeBoundary><BlindMarketPage /></ModeBoundary>} />
          <Route path="/challenge/market-maker" element={<ModeBoundary><MarketMakerPage /></ModeBoundary>} />
          <Route path="/challenge/black-swan" element={<ModeBoundary><MarketShockPage /></ModeBoundary>} />
          <Route path="/challenge/cross-arbitrage" element={<ModeBoundary><CrossArbitragePage /></ModeBoundary>} />
          <Route
            path="/challenge/cross-arbitrage/shared"
            element={<SharedChallengePage />}
          />
          <Route path="/challenge/:id/shared" element={<SharedChallengePage />} />

          <Route path="/duel/room/:roomId" element={<RoomPage />} />
          <Route path="/duel/:challengeType" element={<DuelLanding />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          <Route path="/company" element={<CompanyPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/careers" element={<CareersPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
