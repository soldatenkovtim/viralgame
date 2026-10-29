import { describe, expect, it } from 'vitest'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import { toPoints } from '@/store/gameStore'
import type { PositionEvent } from './positionAnalysis'
import type { BlindDecision } from '@/types/game'
import { blindScore, computeBlindMarket } from './scoring'
import { decisionObservation, formatCapitalChange, formatResultPercent, scoreContributions, segmentPositionPnls } from './resultAnalysis'

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
    expect(decisionObservation(decision(0), -0.2, false, 'flat')).toBe('До следующей точки капитал оставался вне рынка.')
  })
  it.each([
    [0.25, 'open-long'],
    [-0.25, 'open-short'],
    [0.5, 'increase'],
    [0.125, 'reduce'],
    [-0.25, 'reverse-short'],
    [0, 'close'],
  ] as const)('describes the interval for %s / %s without repeating the action', (exposure, action) => {
    expect(decisionObservation(decision(exposure, 1), 6.7, true, action as PositionEvent)).toBe(exposure === 0 ? 'До завершения сценария капитал оставался вне рынка.' : 'До завершения сценария позиция оставалась открытой.')
  })
  it('reports an unchanged market and omits unknown market outcomes', () => {
    expect(decisionObservation(decision(0), 0, true, 'flat')).toContain('капитал оставался вне рынка')
    expect(decisionObservation(decision(0), undefined, true, 'flat')).toBeNull()
    expect(decisionObservation(decision(0), NaN, true, 'flat')).toBeNull()
  })
})

describe('segment PnL from the trading engine', () => {
  it.each([[0, 0, 0], [1, -1, -1], [0.25, 0.5, 0.75], [0.25, 0.125, 0]])('reconciles all segments for %j', (...exposures) => {
    const scenario = blindMarketScenarios[2]
    const decisions = exposures.map((exposure, index) => decision(exposure, index))
    const pnls = segmentPositionPnls(scenario, decisions)
    expect(pnls.reduce((a, b) => a + b, 0)).toBeCloseTo(computeBlindMarket(scenario, decisions).pnl, 8)
    if (exposures[1] === -1) { expect(pnls[1]).toBeLessThan(0); expect(pnls[2]).toBeLessThan(0) }
  })
  it('uses engine stop and gap fills even if price later recovers', () => {
    const base = blindMarketScenarios[0]
    const scenario = { ...base, checkpoints: [1, 3, 5], candles: [100, 95, 105, 110, 115, 120].map((close, i) => ({
      time: 1800000000 + i * 900, open: close, high: close + 1, low: close - 1, close, volume: 100,
    })) }
    const decisions = [decision(1), decision(0, 1), decision(0, 2)]
    decisions[0].stopPrice = 98
    const before = structuredClone(decisions)
    expect(segmentPositionPnls(scenario, decisions)).toEqual([-50000, 0, 0])
    expect(decisions).toEqual(before)
  })
})
