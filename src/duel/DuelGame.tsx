import { BlindMarketGame } from '@/games/blind-market/BlindMarketGame'
import { MarketMakerGame } from '@/games/market-maker/MarketMakerGame'
import { MarketShockGame } from '@/games/market-shock/MarketShockGame'
import { CrossArbitrageGame } from '@/games/cross-arbitrage/CrossArbitrageGame'
import { scenarioCatalog } from '@/modes/scenarios'
import type { ResultPayload } from '@/store/gameStore'
import type { ChallengeType } from '@/types/game'

export function DuelGame({ market, onComplete }: { market: { challengeType: ChallengeType; scenarioId: string; seed: number }; onComplete: (result: ResultPayload) => void }) {
  if (!Object.hasOwn(scenarioCatalog, market.challengeType) || !scenarioCatalog[market.challengeType].some(s => s.id === market.scenarioId && s.seed === market.seed)) return <p className="mx-auto max-w-3xl p-10 text-chalk-200">Этот сценарий больше не поддерживается. Создай новую дуэль.</p>
  const context = { mode: 'duel' as const, seed: market.seed }
  switch (market.challengeType) {
    case 'blind-market': return <BlindMarketGame context={context} scenario={scenarioCatalog['blind-market'].find(s => s.id === market.scenarioId)!} onComplete={result => onComplete({ challengeType: 'blind-market', result })} />
    case 'market-maker': return <MarketMakerGame context={context} scenario={scenarioCatalog['market-maker'].find(s => s.id === market.scenarioId)!} onComplete={result => onComplete({ challengeType: 'market-maker', result })} />
    case 'black-swan': return <MarketShockGame context={context} scenario={scenarioCatalog['black-swan'].find(s => s.id === market.scenarioId)!} onComplete={result => onComplete({ challengeType: 'black-swan', result })} />
    case 'cross-arbitrage': return <CrossArbitrageGame context={context} session={scenarioCatalog['cross-arbitrage'].find(s => s.id === market.scenarioId)!} onComplete={result => onComplete({ challengeType: 'cross-arbitrage', result })} />
  }
}
