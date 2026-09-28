import { allArchetypeNames } from '@/lib/profile'
import { createRandom } from '@/lib/random'

export interface LeaderboardEntry {
  rank: number
  nickname: string
  score: number
  archetype: string
  isCurrentUser?: boolean
}

const NICKNAMES = [
  'deltahedge',
  'volhunter',
  'marketghost',
  'basispoint',
  'flat_book',
  'meanrevert',
  'carrytrade',
  'gamma_scalp',
  'tick_by_tick',
  'iron_condor',
  'short_vega',
  'liquidity_gap',
  'orderflow_ru',
  'skewtrader',
  'nightsession',
  'rho_negative',
  'spread_eagle',
  'quiet_alpha',
  'triangular',
  'funding_rate',
  'no_slippage',
  'thin_book',
  'kappa_one',
  'stoploss_off',
  'overnight_gap',
  'calendar_roll',
  'pairs_only',
  'bid_ask_ru',
  'halfkelly',
  'latency_arb',
  'cash_and_carry',
  'vwap_chaser',
  'drawdown_zero',
  'contango_kid',
  'backwardation',
  'sigma_three',
  'flow_reader',
  'micro_price',
  'inventory_ok',
  'toxic_flow',
  'sharpe_two',
  'tail_hedge',
  'roll_yield',
  'market_depth',
]

/**
 * Рейтинг в прототипе полностью смоделирован.
 * Генерация детерминированная, чтобы список не прыгал между рендерами.
 */
function buildMockLeaderboard(mode: 'standard' | 'advanced' = 'standard'): Omit<LeaderboardEntry, 'rank'>[] {
  const random = createRandom(mode === 'advanced' ? 99173 : 77123)

  return NICKNAMES.map((nickname, index) => {
    // Верхние ники получают более высокий score, но с заметным разбросом.
    const base = 8600 - index * 135
    const noise = random.normal(0, 380)
    const score = Math.max(1200, Math.round(base + noise))

    return {
      nickname,
      score,
      archetype: random.pick(allArchetypeNames),
    }
  }).sort((a, b) => b.score - a.score)
}

export const mockLeaderboard = buildMockLeaderboard()

export interface CurrentUser {
  nickname: string
  score: number
  archetype: string
}

/** Вставляет игрока в таблицу по его score и пересчитывает места. */
export function buildLeaderboard(currentUser?: CurrentUser | null, mode: 'standard' | 'advanced' = 'standard'): LeaderboardEntry[] {
  const entries: Omit<LeaderboardEntry, 'rank'>[] = [...(mode === 'advanced' ? buildMockLeaderboard('advanced') : mockLeaderboard)]

  if (currentUser) {
    entries.push({ ...currentUser, isCurrentUser: true })
  }

  return entries
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
