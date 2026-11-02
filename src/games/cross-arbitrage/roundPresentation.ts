import type { ArbitrageRoundResult, CrossArbitrageScenario } from '@/types/game'
import { bestTrade, buildQuotePath } from './engine'

/** Presentation compares feasible trades on the execution snapshot. Scoring still owns its initial benchmark. */
export function roundPresentation(round: ArbitrageRoundResult, scenario: CrossArbitrageScenario) {
  const currentBest = bestTrade(buildQuotePath(scenario)[round.quoteStep])
  const hasCurrentOpportunity = currentBest.capitalReturn > 0
  const initialOpportunityClosed = round.choseNoTrade && !hasCurrentOpportunity && round.optimalNetReturn > 0
  const comparison = initialOpportunityClosed ? bestTrade(scenario.quotes) : currentBest
  const betterAvailable = comparison.capitalReturn > Math.max(0, round.capitalReturn) + 1e-12
  const sameRoute = comparison.buyVenue === round.buyVenue && comparison.sellVenue === round.sellVenue
  const bestExecution = !round.choseNoTrade && round.capitalReturn > 0
    && Math.abs(currentBest.capitalReturn - round.capitalReturn) <= 1e-12

  let observation: string
  if (round.choseNoTrade) {
    observation = hasCurrentOpportunity ? 'На рынке была доступна прибыльная возможность.'
      : initialOpportunityClosed ? 'В начале раунда была прибыльная возможность. К моменту решения она закрылась.'
        : 'Прибыльных маршрутов после комиссий и издержек не было.'
  } else if (round.netReturn === 0) {
    observation = 'Разница цен точно покрыла издержки. Капитал не изменился.'
  } else if (round.netReturn > 0) {
    observation = round.liquidityHit
      ? 'Сделка принесла прибыль после комиссий и проскальзывания.'
      : 'Разница цен покрыла комиссии. Сделка принесла прибыль.'
  } else {
    observation = round.liquidityHit
      ? 'Комиссии и исполнение части объёма по менее выгодным ценам привели к убытку.'
      : 'Разницы между ценой продажи и покупки не хватило, чтобы покрыть комиссии.'
  }

  return {
    observation,
    bestExecution,
    comparison: betterAvailable ? comparison : undefined,
    comparisonTitle: initialOpportunityClosed ? 'Возможность в начале раунда'
      : round.choseNoTrade ? 'Доступный маршрут'
        : sameRoute ? 'Другой объём дал бы больше' : 'Был более выгодный маршрут',
    comparisonMoment: initialOpportunityClosed ? 'В начале раунда' : 'В момент решения',
  }
}
