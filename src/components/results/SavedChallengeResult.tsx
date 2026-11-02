import { LinkButton } from '@/components/ui/Button'
import { BlindMarketResult } from '@/games/blind-market/BlindMarketResult'
import { MarketMakerResult } from '@/games/market-maker/MarketMakerResult'
import { MarketShockResult } from '@/games/market-shock/MarketShockResult'
import { CrossArbitrageResult } from '@/games/cross-arbitrage/CrossArbitrageResult'
import { findScenarioById } from '@/modes/scenarios'
import { toPoints, useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

/** Read-only view: do not mount games/useScenario or save another attempt. */
export function SavedChallengeResult({ challenge }: { challenge: ChallengeType }) {
  const state = useGameStore()
  const outcome = (score: number): SaveOutcome => ({
    points: toPoints(score), previousBest: null, isPersonalBest: false,
    pointsToBest: 0, unlockedNext: null, seriesCompleted: state.completedChallenges.length === 4,
  })
  const next = { nextHref: '/profile', nextLabel: 'Вернуться к профилю' }
  let content: React.ReactNode = null
  if (challenge === 'blind-market' && state.blindMarketResult) {
    const result = state.blindMarketResult
    const scenario = findScenarioById(challenge, result.scenarioId)
    if (scenario) content = <BlindMarketResult scenario={scenario} result={result} outcome={outcome(result.score)} {...next} />
  }
  if (challenge === 'market-maker' && state.marketMakerResult) {
    const result = state.marketMakerResult
    if (findScenarioById(challenge, result.scenarioId)) content = <MarketMakerResult result={result} outcome={outcome(result.score)} {...next} />
  }
  if (challenge === 'black-swan' && state.blackSwanResult) {
    const result = state.blackSwanResult
    const scenario = findScenarioById(challenge, result.scenarioId)
    if (scenario) content = <MarketShockResult scenario={scenario} result={result} outcome={outcome(result.score)} {...next} />
  }
  if (challenge === 'cross-arbitrage' && state.crossArbitrageResult) {
    const result = state.crossArbitrageResult
    const session = findScenarioById(challenge, result.scenarioId)
    if (session) content = <CrossArbitrageResult session={session} result={result} outcome={outcome(result.score)} />
  }
  return <>
    <div className="site-container flex flex-wrap items-center justify-between gap-3 py-6">
      <p className="text-sm text-chalk-400">{content ? 'Сохранённый разбор текущей серии · результат может отличаться от личного рекорда' : 'Сохранённый разбор недоступен в этом браузере.'}</p>
      <LinkButton to="/profile">Вернуться к профилю</LinkButton>
    </div>
    {content}
  </>
}
