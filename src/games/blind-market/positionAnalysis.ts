import type { BlindDecision, BlindStopHit } from '@/types/game'

/** Presentation-only classification; never used by the trading engine or scorer. */
export type PositionEvent = 'open-long' | 'open-short' | 'close' | 'increase' | 'reduce'
  | 'reverse-long' | 'reverse-short' | 'hold' | 'flat' | 'unknown'

export function classifyPositionChange(before: number | undefined, after: number | undefined): PositionEvent {
  if (typeof before !== 'number' || !Number.isFinite(before)
    || typeof after !== 'number' || !Number.isFinite(after)) return 'unknown'
  if (before === 0) return after === 0 ? 'flat' : after > 0 ? 'open-long' : 'open-short'
  if (after === 0) return 'close'
  if (Math.sign(before) !== Math.sign(after)) return after > 0 ? 'reverse-long' : 'reverse-short'
  if (Math.abs(after) > Math.abs(before)) return 'increase'
  if (Math.abs(after) < Math.abs(before)) return 'reduce'
  return 'hold'
}

export function positionEvents(decisions: readonly BlindDecision[], stopHits?: readonly BlindStopHit[]): PositionEvent[] {
  return decisions.map((decision, index) => {
    const previous = decisions[index - 1]
    const before = index === 0
      ? decision.checkpointIndex === 0 ? 0 : undefined
      : previous && decision.checkpointIndex === previous.checkpointIndex + 1
        ? stopHits?.some(hit => hit.segment === previous.checkpointIndex && Number.isFinite(hit.price)) ? 0 : previous.exposure
        : undefined
    return classifyPositionChange(before, decision.exposure)
  })
}

export function isReversal(event: PositionEvent): boolean {
  return event === 'reverse-long' || event === 'reverse-short'
}

export const positionEventLabels: Record<PositionEvent, string> = {
  'open-long': 'Открытие лонга', 'open-short': 'Открытие шорта', close: 'Закрытие позиции',
  increase: 'Увеличение позиции', reduce: 'Сокращение позиции',
  'reverse-long': 'Разворот в лонг', 'reverse-short': 'Разворот в шорт',
  hold: 'Сохранение позиции', flat: 'Вне рынка', unknown: 'Решение',
}
