import { findScenarioById } from '@/modes/scenarios'
import type { ScenarioMode } from '@/scenario-engine/scenarioTypes'
import { formatResultPercent, isFiniteMarketReturn, marketMovement } from '@/games/blind-market/resultAnalysis'
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

export function blindMarketAchievement(result: BlindMarketResult, mode?: ScenarioMode): Achievement | null {
  const scenario = findScenarioById('blind-market', result.scenarioId, mode)
  const candidates: Achievement[] = []

  const firstDecision = result.decisions?.[0]
  if (scenario && firstDecision && Number.isFinite(firstDecision.exposure) && firstDecision.exposure !== 0
    && firstDecision.checkpointIndex === 0 && Number.isFinite(firstDecision.priceAtDecision) && firstDecision.priceAtDecision > 0
    && scenario.checkpoints[firstDecision.checkpointIndex] !== undefined) {
    const revealed = scenario.candles.slice(scenario.checkpoints[firstDecision.checkpointIndex])
    const lows = revealed.map((candle) => candle.low)
    const highs = revealed.map((candle) => candle.high)
    const extreme =
      firstDecision.exposure > 0 ? Math.min(...lows) : Math.max(...highs)
    const distance = Math.abs(firstDecision.priceAtDecision - extreme) / extreme

    if (Number.isFinite(extreme) && extreme > 0 && distance <= 0.02) {
      candidates.push({
        id: 'caught-reversal',
        title: 'Вход рядом с экстремумом',
        description: `В первой точке вы открыли позицию в пределах 2% от ${firstDecision.exposure > 0 ? 'минимальной' : 'максимальной'} цены последующего участка до конца сценария. Это наблюдение по завершённому рынку.`,
      })
    }
  }

  const flatIndex = result.decisions?.findIndex((decision, index) => {
    const segmentReturn = result.segmentReturns?.[index]
    return decision.checkpointIndex === index && decision.exposure === 0 && isFiniteMarketReturn(segmentReturn) && Math.abs(segmentReturn) < 1.5
  }) ?? -1
  if (flatIndex >= 0) {
    const segmentReturn = result.segmentReturns[flatIndex]
    // Keep the existing eligibility threshold, but describe only this exact interval.
    const last = scenario ? flatIndex === scenario.checkpoints.length - 1 : false
    const movement = marketMovement(segmentReturn, last)
    candidates.push({
      id: 'stayed-out',
      title: 'Вне рынка',
      description: `В точке решения ${flatIndex + 1} вы остались вне рынка. ${scenario ? movement : movement.replace('До следующей точки', 'На последующем участке')}`,
    })
  }

  if (isFiniteMarketReturn(result.maxDrawdown) && result.maxDrawdown >= 0
    && result.maxDrawdown < 1.2 && isFiniteMarketReturn(result.pnlPercent) && result.pnlPercent > 0) {
    candidates.push({
      id: 'clean-run',
      title: 'Небольшая просадка',
      description: `Максимальная просадка капитала от достигнутого пика составила ${formatResultPercent(result.maxDrawdown, false)}. Сценарий завершён с положительным результатом.`,
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
      description: 'Ваша позиция ни разу не превысила заданный уровень риска.',
    })
  }

  const informed = result.phases.filter((phase) => phase.regime === 'informed')
  if (informed.length > 0 && informed.every((phase) => phase.pnlChange > 0)) {
    candidates.push({
      id: 'survived-toxic',
      title: 'Токсичный поток пройден',
      description: 'Вы прошли фазу информированного потока с положительным PnL.',
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
      title: 'Поток собран',
      description: 'Ваша котировка была в рынке почти всё время раунда.',
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
      description: 'Вы сократили позицию до основной части рыночного движения.',
    })
  }

  if (result.pnlPercent > 0) {
    candidates.push({
      id: 'through-the-storm',
      title: 'Шторм пройден',
      description: 'Вы закончили сценарий в плюсе, несмотря на рыночный шок.',
    })
  }

  if (result.levels.length > 0 && result.positionChanges > 0) {
    candidates.push({
      id: 'marked-levels',
      title: 'По своей разметке',
      description: 'Вы отметили уровни на этапе контекста и меняли позицию по ходу сценария.',
    })
  }

  if (result.maxDrawdown < 4) {
    candidates.push({
      id: 'shallow-drawdown',
      title: 'Мелкая просадка',
      description: 'Ваша просадка осталась ниже 4% на всём сценарии.',
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
      description: 'Вы не открывали сделки в рынках без исполнимой возможности.',
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
      description: 'Вы нашли возможность менее чем за 5 секунд до схождения котировок.',
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
      description: 'Во всех прибыльных рынках вы выбрали оптимальную пару площадок.',
    })
  }

  return pickOne(candidates)
}
