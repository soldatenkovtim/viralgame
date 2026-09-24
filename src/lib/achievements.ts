import { getBlindScenario } from '@/data/blindMarketScenarios'
import type {
  Achievement,
  BlackSwanResult,
  BlindMarketResult,
  MarketMakerResult,
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

  if (result.botType === 'informed' && result.pnl > 0) {
    candidates.push({
      id: 'survived-toxic',
      title: 'Пережил токсичный поток',
      description: 'Ты закончил раунд положительно против информированного бота.',
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

export function blackSwanAchievement(result: BlackSwanResult): Achievement | null {
  const candidates: Achievement[] = []

  const reducedBeforeShock = result.decisions.some(
    (decision) =>
      decision.phaseIndex === 0 &&
      Math.abs(decision.exposureAfter) < Math.abs(decision.exposureBefore),
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

  if (result.maxDrawdown < 4) {
    candidates.push({
      id: 'shallow-drawdown',
      title: 'Мелкая просадка',
      description: 'Твоя просадка осталась ниже 4% на всём сценарии.',
    })
  }

  return pickOne(candidates)
}
