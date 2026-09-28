import { getBlindScenario } from '@/data/blindMarketScenarios'
import type {
  Achievement,
  BlindMarketResult,
  CrossArbitrageResult,
  MarketMakerResult,
  MarketShockResult,
} from '@/types/game'

/**
 * «Неожиданный факт» по итогам сценария вместо классических бейджей.
 * Если подходит несколько — показывается только один, поэтому конкретное
 * достижение никогда не гарантировано.
 */
function pickOne(candidates: Achievement[]): Achievement | null {
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export function blindMarketAchievement(result: BlindMarketResult): Achievement | null {
  const scenario = getBlindScenario(result.scenarioId)
  const candidates: Achievement[] = []

  const firstDecision = result.decisions[0]
  if (firstDecision && firstDecision.exposure !== 0) {
    const revealed = scenario.candles.slice(scenario.checkpoints[0])
    const lows = revealed.map((candle) => candle.low)
    const highs = revealed.map((candle) => candle.high)
    const extreme =
      firstDecision.exposure > 0 ? Math.min(...lows) : Math.max(...highs)
    const distance = Math.abs(firstDecision.priceAtDecision - extreme) / extreme

    if (distance <= 0.02) {
      candidates.push({
        id: 'caught-reversal',
        title: 'Поймал разворот',
        description: 'Ты открыл позицию в пределах 2% от локального экстремума.',
      })
    }
  }

  const goodFlat = result.decisions.some((decision, index) => {
    const segmentReturn = result.segmentReturns[index]
    return decision.exposure === 0 && Math.abs(segmentReturn ?? 0) < 1.5
  })
  if (goodFlat) {
    candidates.push({
      id: 'stayed-out',
      title: 'Не трогал рынок',
      description: 'Ты выбрал «Вне рынка» там, где движения почти не было.',
    })
  }

  if (result.maxDrawdown < 1.2 && result.pnlPercent > 0) {
    candidates.push({
      id: 'clean-run',
      title: 'Без просадки',
      description: 'Твоя позиция ни разу не ушла заметно против тебя.',
    })
  }

  return pickOne(candidates)
}

export function marketMakerAchievement(result: MarketMakerResult): Achievement | null {
  const candidates: Achievement[] = []

  if (result.maxInventory <= 6 && result.tradeCount >= 8) {
    candidates.push({
      id: 'calm-inventory',
      title: 'Спокойный инвентарь',
      description: 'Твоя позиция ни разу не превысила заданный уровень риска.',
    })
  }

  const informed = result.phases.filter((phase) => phase.regime === 'informed')
  if (informed.length > 0 && informed.every((phase) => phase.pnlChange > 0)) {
    candidates.push({
      id: 'survived-toxic',
      title: 'Пережил токсичный поток',
      description: 'Ты прошёл фазу информированного потока с положительным PnL.',
    })
  }

  if (result.spreadPnl > 0 && result.spreadPnl >= Math.abs(result.inventoryPnl) * 3 && result.tradeCount >= 20) {
    candidates.push({
      id: 'spread-capture',
      title: 'Чистый спред',
      description: 'Почти весь результат пришёл от спреда, а не от движения позиции.',
    })
  }

  if (result.tradeCount >= 25) {
    candidates.push({
      id: 'flow-magnet',
      title: 'Собрал поток',
      description: 'Твоя котировка была в рынке почти всё время раунда.',
    })
  }

  return pickOne(candidates)
}

export function marketShockAchievement(result: MarketShockResult): Achievement | null {
  const candidates: Achievement[] = []

  const reducedBeforeShock = result.decisions.some(
    (decision) =>
      decision.phase === 1 &&
      Math.abs(decision.positionAfter) < Math.abs(decision.positionBefore),
  )
  if (reducedBeforeShock) {
    candidates.push({
      id: 'early-exit',
      title: 'Ранний выход',
      description: 'Ты сократил позицию до основной части рыночного движения.',
    })
  }

  if (result.pnlPercent > 0) {
    candidates.push({
      id: 'through-the-storm',
      title: 'Прошёл шторм',
      description: 'Ты закончил сценарий в плюсе, несмотря на рыночный шок.',
    })
  }

  if (result.levels.length > 0 && result.positionChanges > 0) {
    candidates.push({
      id: 'marked-levels',
      title: 'По своей разметке',
      description: 'Ты отметил уровни на этапе контекста и менял позицию по ходу сценария.',
    })
  }

  if (result.maxDrawdown < 4) {
    candidates.push({
      id: 'shallow-drawdown',
      title: 'Мелкая просадка',
      description: 'Твоя просадка осталась ниже 4% на всём сценарии.',
    })
  }

  return pickOne(candidates)
}

export function crossArbitrageAchievement(result: CrossArbitrageResult): Achievement | null {
  const candidates: Achievement[] = []
  const { rounds } = result

  if (result.tradeCount > 0 && result.falseTrades === 0) {
    candidates.push({
      id: 'clean-spread',
      title: 'Чистый спред',
      description: 'Ни одной сделки с отрицательным net edge.',
    })
  }

  const emptyRounds = rounds.filter((round) => round.optimalNetReturn <= 0)
  if (emptyRounds.length > 0 && emptyRounds.every((round) => round.choseNoTrade && !round.timedOut)) {
    candidates.push({
      id: 'no-fuss',
      title: 'Без суеты',
      description: 'Ты правильно пропустил все ложные возможности.',
    })
  }

  const closeCall = rounds.some(
    (round) =>
      round.profitable &&
      round.msBeforeClose !== undefined &&
      round.msBeforeClose > 0 &&
      round.msBeforeClose < 5000,
  )
  if (closeCall) {
    candidates.push({
      id: 'window-closing',
      title: 'Окно закрывается',
      description: 'Ты нашёл возможность менее чем за 5 секунд до схождения котировок.',
    })
  }

  const opportunityRounds = rounds.filter((round) => round.optimalNetReturn > 0)
  if (
    opportunityRounds.length > 0 &&
    opportunityRounds.every((round) => round.optimalChoice)
  ) {
    candidates.push({
      id: 'best-route',
      title: 'Лучший маршрут',
      description: 'Во всех прибыльных рынках ты выбрал оптимальную пару площадок.',
    })
  }

  return pickOne(candidates)
}
