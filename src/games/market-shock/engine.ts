import { CAPITAL } from '@/lib/constants'
import type { MarketShockScenario, ShockAction, ShockDecision } from '@/types/game'

export const DECISION_SECONDS = 20
export const HEDGE_RESIDUAL = 0.35
export const INCREASE_FACTOR = 1.4
export const MAX_EXPOSURE = 1
/** Стоимость хеджа — доля капитала за одно решение. */
export const HEDGE_COST_RATE = 0.0003
export const MAX_LEVELS = 2

export const SHOCK_ACTIONS: ShockAction[] = ['close', 'hedge', 'hold', 'increase']

/** Нейтральные названия фаз: не подсказывают, чем закончится сценарий. */
export const PHASE_TITLES = ['Первые изменения', 'Резкое движение', 'Развитие'] as const

export const actionLabels: Record<ShockAction, string> = {
  close: 'Закрыть',
  hedge: 'Хеджировать',
  hold: 'Держать',
  increase: 'Увеличить',
}

export const actionPastLabels: Record<ShockAction, string> = {
  close: 'Закрыл',
  hedge: 'Хеджировал',
  hold: 'Держал',
  increase: 'Увеличил',
}

export function initialExposure(scenario: MarketShockScenario): number {
  const { direction, exposure } = scenario.initialPosition
  return direction === 'long' ? exposure : -exposure
}

/** Размер округляется до процента одинаково для лонга и шорта. */
function withSide(position: number, size: number): number {
  return (Math.sign(position) * Math.round(size * 100)) / 100
}

/** Все действия меняют размер относительно текущей позиции, а не абсолютно. */
export function applyShockAction(position: number, action: ShockAction): number {
  switch (action) {
    case 'close':
      return 0
    case 'hedge':
      return withSide(position, Math.abs(position) * HEDGE_RESIDUAL)
    case 'increase':
      return withSide(position, Math.min(Math.abs(position) * INCREASE_FACTOR, MAX_EXPOSURE))
    default:
      return position
  }
}

/** Действие меняет позицию. Нельзя хеджировать или наращивать пустую позицию. */
export function isActionEffective(position: number, action: ShockAction): boolean {
  return applyShockAction(position, action) !== position
}

export function positionLabel(position: number): string {
  if (position === 0) return 'Вне рынка'
  return `${position > 0 ? 'LONG' : 'SHORT'} ${Math.round(Math.abs(position) * 100)}%`
}

export function decisionCandleIndex(scenario: MarketShockScenario, phase: number): number {
  return scenario.phaseCheckpoints[phase - 1] - 1
}

export interface ShockPathPoint {
  index: number
  price: number
  pnl: number
  pnlPercent: number
  exposure: number
}

export interface ShockSimulation {
  /** Точки от последней свечи контекста до `endIndex` включительно. */
  points: ShockPathPoint[]
  pnl: number
  pnlPercent: number
  maxDrawdown: number
  maxDrawdownIndex: number
  maxPnlPercent: number
  maxPnlIndex: number
}

/**
 * Переоценка позиции по закрытиям свечей. Позиция хранится в единицах актива:
 * после сокращения следующие движения влияют только на остаток.
 */
export function simulateShock(
  scenario: MarketShockScenario,
  decisions: Pick<ShockDecision, 'phase' | 'action' | 'positionBefore' | 'positionAfter'>[],
  endIndex = scenario.candles.length - 1,
): ShockSimulation {
  const { candles, initialPosition } = scenario
  const start = scenario.initialVisibleIndex - 1
  const last = Math.min(endIndex, candles.length - 1)

  let exposure = initialExposure(scenario)
  let units = (exposure * CAPITAL) / initialPosition.entryPrice
  let pnl = units * (candles[start].close - initialPosition.entryPrice)

  const byIndex = new Map(decisions.map((decision) => [decisionCandleIndex(scenario, decision.phase), decision]))
  const points: ShockPathPoint[] = []

  let peak = CAPITAL + pnl
  let maxDrawdown = 0
  let maxDrawdownIndex = start
  let maxPnl = pnl
  let maxPnlIndex = start

  for (let i = start; i <= last; i += 1) {
    const price = candles[i].close
    if (i > start) pnl += units * (price - candles[i - 1].close)

    const equity = CAPITAL + pnl
    if (equity > peak) peak = equity
    const drawdown = ((peak - equity) / peak) * 100
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownIndex = i
    }
    if (pnl > maxPnl) {
      maxPnl = pnl
      maxPnlIndex = i
    }

    points.push({ index: i, price, pnl, pnlPercent: (pnl / CAPITAL) * 100, exposure })

    const decision = byIndex.get(i)
    if (decision) {
      if (decision.action === 'hedge' && decision.positionBefore !== 0) {
        pnl -= CAPITAL * HEDGE_COST_RATE
      }
      exposure = decision.positionAfter
      units = (exposure * CAPITAL) / price
    }
  }

  return {
    points,
    pnl,
    pnlPercent: (pnl / CAPITAL) * 100,
    maxDrawdown,
    maxDrawdownIndex,
    maxPnlPercent: (maxPnl / CAPITAL) * 100,
    maxPnlIndex,
  }
}

export function pnlPercentAt(
  scenario: MarketShockScenario,
  decisions: ShockDecision[],
  index: number,
): number {
  return simulateShock(scenario, decisions, index).pnlPercent
}

/** Решения «держать» во всех фазах — базовая линия для сравнения. */
export function holdDecisions(scenario: MarketShockScenario): ShockDecision[] {
  const position = initialExposure(scenario)
  return [1, 2, 3].map((phase) => ({
    phase,
    action: 'hold' as const,
    positionBefore: position,
    positionAfter: position,
    price: scenario.candles[decisionCandleIndex(scenario, phase)].close,
    pnlBefore: 0,
    decisionTimeMs: 0,
    timestamp: 0,
    timedOut: false,
  }))
}

/** Строит решения из цепочки действий — для тестов, демо и калибровки. */
export function decisionsFromActions(
  scenario: MarketShockScenario,
  actions: ShockAction[],
  decisionTimeMs = 6000,
): ShockDecision[] {
  let position = initialExposure(scenario)
  const decisions: ShockDecision[] = []
  actions.forEach((action, index) => {
    const phase = index + 1
    const candleIndex = decisionCandleIndex(scenario, phase)
    const positionAfter = applyShockAction(position, action)
    decisions.push({
      phase,
      action,
      positionBefore: position,
      positionAfter,
      price: scenario.candles[candleIndex].close,
      pnlBefore: pnlPercentAt(scenario, decisions, candleIndex),
      decisionTimeMs,
      timestamp: 0,
      timedOut: false,
    })
    position = positionAfter
  })
  return decisions
}
