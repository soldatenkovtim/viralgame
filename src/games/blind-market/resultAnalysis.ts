import { formatPercent } from '@/lib/formatting'
import type { BlindDecision, BlindStopHit, BlindMarketScenario } from '@/types/game'
import type { PositionEvent } from './positionAnalysis'
import { blindScore, simulateBlind } from './scoring'

/** Keep a small nonzero return visible; presentation only, never used for scoring. */
export function formatResultPercent(value: number, withSign = true): string {
  const digits = value !== 0 && Math.abs(value) < 0.05
    ? Math.min(10, Math.max(2, 1 - Math.floor(Math.log10(Math.abs(value))))) : 1
  return formatPercent(value, digits, withSign).replace('-', '−')
}

export function formatCapitalChange(value: number): string {
  const digits = value !== 0 && Math.abs(value) < 1
    ? Math.min(10, Math.max(2, 1 - Math.floor(Math.log10(Math.abs(value))))) : 0
  const amount = Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: digits })
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${amount}`
}

/** Isolate each component using the existing scorer's zero-contribution boundaries. */
export function scoreContributions(pnlPercent: number, maxDrawdown: number) {
  return {
    returnPoints: blindScore(pnlPercent, 12) * 100,
    drawdownPoints: blindScore(-12, maxDrawdown) * 100,
  }
}

export function isFiniteMarketReturn(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function marketMovement(marketReturn: number, last: boolean): string {
  const period = last ? 'До завершения сценария' : 'До следующей точки'
  const movement = marketReturn === 0 ? 'цена не изменилась' : `цена ${marketReturn > 0 ? 'выросла' : 'снизилась'} на ${formatResultPercent(Math.abs(marketReturn), false)}`
  return `${period} ${movement}.`
}

export function decisionObservation(
  decision: BlindDecision,
  marketReturn: number | null | undefined,
  last: boolean,
  event: PositionEvent,
  stop?: BlindStopHit,
): string | null {
  if (!isFiniteMarketReturn(marketReturn)) return null
  const period = last ? 'До завершения сценария' : 'До следующей точки'
  if (stop && Number.isFinite(stop.price)) {
    return `${period} показано движение цены за весь участок, включая время после закрытия позиции по стопу.`
  }
  if (event === 'unknown') return `${period} показано изменение рыночной цены.`
  return decision.exposure === 0
    ? `${period} капитал оставался вне рынка.`
    : `${period} позиция оставалась открытой.`
}

/** Differences of cumulative engine PnL, including stops and gap execution. */
export function segmentPositionPnls(scenario: BlindMarketScenario, decisions: BlindDecision[]): number[] {
  let previous = 0
  return decisions.map((_, index) => {
    const end = (scenario.checkpoints[index + 1] ?? scenario.candles.length) - 1
    const cumulative = simulateBlind(scenario, decisions, end).pnl
    const pnl = cumulative - previous
    previous = cumulative
    return pnl
  })
}
