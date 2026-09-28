/**
 * Mock-аналитика прототипа.
 *
 * Бэкенда нет — события просто пишутся в консоль. Набор и форма событий
 * подобраны так, чтобы в рабочей версии из них считались воронки:
 * start rate, completion rate, переходы 1→2, 2→3 и 3→4, share rate,
 * открытие и прохождение shared-ссылок, replay rate и конверсия в карьеру.
 */
export type AnalyticsEvent =
  | 'game_opened'
  | 'game_started'
  | 'blind_market_started'
  | 'blind_market_completed'
  | 'market_maker_started'
  | 'market_maker_completed'
  | 'black_swan_started'
  | 'black_swan_completed'
  | 'cross_arbitrage_started'
  | 'cross_arbitrage_round'
  | 'cross_arbitrage_completed'
  | 'profile_viewed'
  | 'challenge_shared'
  | 'shared_challenge_opened'
  | 'shared_challenge_completed'
  | 'leaderboard_viewed'
  | 'company_cta_clicked'
  | 'career_form_started'
  | 'career_form_submitted'
  | 'series_restarted'
  | 'share_card_downloaded'

export type AnalyticsPayload = Record<string, unknown>

export function trackEvent(name: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  console.log('[analytics]', name, { ...payload, ts: new Date().toISOString() })
}
