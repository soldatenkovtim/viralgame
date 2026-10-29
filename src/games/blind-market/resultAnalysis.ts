import { formatPercent } from '@/lib/formatting'
import type { BlindDecision, BlindStopHit } from '@/types/game'
import type { PositionEvent } from './positionAnalysis'
import { blindScore } from './scoring'
import { formatPositionLabel } from './terminalFormatting'

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
  const position = formatPositionLabel(decision.exposure).toLocaleLowerCase('ru-RU')
  let action: string
  switch (event) {
    case 'close': action = 'Вы закрыли позицию.'; break
    case 'increase': action = `Вы увеличили позицию: ${position}.`; break
    case 'reduce': action = `Вы сократили позицию: ${position}.`; break
    case 'reverse-long':
    case 'reverse-short': action = `Вы развернули позицию: ${position}.`; break
    case 'hold': action = `Вы сохранили позицию: ${position}.`; break
    case 'flat': action = 'Вы остались вне рынка.'; break
    case 'open-long':
    case 'open-short': action = `Вы открыли ${position}.`; break
    default: action = 'Недостаточно данных об изменении позиции.'
  }
  const afterStop = stop && Number.isFinite(stop.price)
    ? ' Это движение цены за весь участок, включая время после закрытия позиции по стопу; оно не является доходностью вашей сделки.' : ''
  return `${action} ${marketMovement(marketReturn, last)}${afterStop}`
}
