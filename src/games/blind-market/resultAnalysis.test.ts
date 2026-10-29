import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { toPoints } from '@/store/gameStore'
import type { PositionEvent } from './positionAnalysis'
import type { BlindDecision } from '@/types/game'
import { blindScore, computeBlindMarket } from './scoring'
import { decisionObservation, formatCapitalChange, formatResultPercent, scoreContributions } from './resultAnalysis'

function decision(exposure: number, checkpointIndex = 0, action?: BlindDecision['action']): BlindDecision {
  return { exposure, checkpointIndex, action, direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat', confidence: 70, priceAtDecision: 100, timeMs: 1000 }
}

describe('result display accuracy', () => {
  it.each([[1.7, '+1,7%'], [-1.7, '−1,7%'], [0, '0,0%'], [-0, '0,0%'], [-0.004, '−0,0040%'], [0.004, '+0,0040%']])('formats %s without hiding a nonzero result', (value, text) => {
    expect(formatResultPercent(value as number)).toBe(text)
  })
  it('keeps the sign and unit-independent money amount, including tiny losses', () => {
    expect(formatCapitalChange(16587).replaceAll('\u00a0', ' ')).toBe('+16 587')
    expect(formatCapitalChange(-16587).replaceAll('\u00a0', ' ')).toBe('−16 587')
    expect(formatCapitalChange(-0.004)).toBe('−0,004')
    expect(formatCapitalChange(0)).toBe('0')
  })
  it.each([[-20, 20], [-12, 12], [-0.004, 0.001], [0, 0], [1.7, 0.3], [12, 0], [25, 0]])('matches existing score at return %s, drawdown %s', (pnl, drawdown) => {
    const { returnPoints, drawdownPoints } = scoreContributions(pnl, drawdown)
    expect(Math.round(returnPoints + drawdownPoints)).toBe(toPoints(blindScore(pnl, drawdown)))
  })
  it.each([
    [[0, 0, 0], 0], [[0, 0.25, 0], 2], [[0.25, 0.5, 0.125], 0], [[0.25, -0.25, -0.25], 1],
  ] as const)('documents the existing position-state metric for %j', (exposures, transitions) => {
    const result = computeBlindMarket(blindMarketScenarios[0], exposures.map((value, index) => decision(value, index)))
    expect(result.directionChanges).toBe(transitions)
    if (exposures.every(value => value === 0)) {
      expect(result.pnl).toBe(0)
      expect(result.maxDrawdown).toBe(0)
      expect(toPoints(result.score)).toBe(6400)
    }
  })
})

describe('objective decision observations', () => {
  it('describes being flat without evaluating its correctness', () => {
    expect(decisionObservation(decision(0), -0.2, false, 'flat')).toBe('Вы остались вне рынка. До следующей точки цена снизилась на 0,2%.')
  })
  it.each([
    [0.25, 'open-long', 'Вы открыли лонг 25%.'],
    [-0.25, 'open-short', 'Вы открыли шорт 25%.'],
    [0.5, 'increase', 'Вы увеличили позицию: лонг 50%.'],
    [0.125, 'reduce', 'Вы сократили позицию: лонг 12,5%.'],
    [-0.25, 'reverse-short', 'Вы развернули позицию: шорт 25%.'],
    [0, 'close', 'Вы закрыли позицию.'],
  ] as const)('describes %s / %s with exact size', (exposure, action, prefix) => {
    expect(decisionObservation(decision(exposure, 1), 6.7, true, action as PositionEvent)).toBe(`${prefix} До завершения сценария цена выросла на 6,7%.`)
  })
  it('reports an unchanged market and omits unknown market outcomes', () => {
    expect(decisionObservation(decision(0), 0, true, 'flat')).toContain('цена не изменилась')
    expect(decisionObservation(decision(0), undefined, true, 'flat')).toBeNull()
    expect(decisionObservation(decision(0), NaN, true, 'flat')).toBeNull()
  })
})
