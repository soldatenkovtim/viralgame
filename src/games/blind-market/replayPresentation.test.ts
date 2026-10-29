import { describe, expect, it } from 'vitest'
import { CHART_COLORS } from '@/components/charts/chartTheme'
import { blindMarketScenarios } from '@/data/blindMarketScenarios'
import type { BlindDecision } from '@/types/game'
import { positionEvents } from './positionAnalysis'
import { buildTradeTimeline, computeBlindMarket } from './scoring'
import { decisionTitle, positionChangeCount, replayMarkers } from './replayPresentation'

const scenario = blindMarketScenarios[0]
const decisionsFor = (exposures: number[]): BlindDecision[] => exposures.map((exposure, checkpointIndex) => ({
  exposure, checkpointIndex, confidence: 70, timeMs: 1000,
  direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat',
  priceAtDecision: scenario.candles[scenario.checkpoints[checkpointIndex] - 1].close,
}))

describe('completed-session presentation', () => {
  it.each([
    [[0, 0, 0], 0], [[0.25, 0.5, 0.75], 3], [[-0.25, -0.25, -0.25], 1],
    [[0.25, 0, 0], 2], [[0.25, -0.25, 0.25], 3], [[0.25, 0.125, 0.125], 2],
  ])('counts real decision changes and retains all three markers for %j', (exposures, count) => {
    const decisions = decisionsFor(exposures as number[])
    const before = structuredClone(decisions)
    const computation = computeBlindMarket(scenario, decisions)
    const timeline = buildTradeTimeline(scenario, decisions, scenario.candles.length - 1, true)
    expect(positionChangeCount(positionEvents(decisions, computation.stopHits))).toBe(count)
    for (const selected of [null, 0, 1, 2]) {
      const markers = replayMarkers(scenario, decisions, timeline.events, selected, scenario.candles.length)
      const numbered = markers.filter(marker => /^\d\d$/.test(marker.text))
      expect(numbered.map(marker => marker.text)).toEqual(['01', '02', '03'])
      expect(numbered.map(marker => marker.candleIndex)).toEqual(scenario.checkpoints.map(value => value - 1))
      if (selected !== null) expect(numbered[selected].shape).toBe('square')
      expect(markers.some(marker => marker.text === '04')).toBe(false)
    }
    expect(decisions).toEqual(before)
    expect(computeBlindMarket(scenario, decisions)).toEqual(computation)
  })

  it('preserves trade colors on selection and distinguishes automatic final liquidation', () => {
    const decisions = decisionsFor([0.25, 0.125, 0])
    const timeline = buildTradeTimeline(scenario, decisions, scenario.candles.length - 1, true)
    const base = replayMarkers(scenario, decisions, timeline.events, null, scenario.candles.length)
    expect(base.map(m => m.color)).toEqual([CHART_COLORS.up, '#9b84ff', '#9b84ff'])
    expect(replayMarkers(scenario, decisions, timeline.events, 1, scenario.candles.length).map(m => m.color)).toEqual(base.map(m => m.color))
    const open = decisionsFor([0.25, 0.5, 0.75])
    const events = buildTradeTimeline(scenario, open, scenario.candles.length - 1, true).events
    expect(replayMarkers(scenario, open, events, null, scenario.candles.length).at(-1)).toMatchObject({ text: 'Ф' })
  })

  it('keeps a decision marker when a stop occurs on the same candle, without counting automatic closure', () => {
    const decisions = decisionsFor([0.25, 0, 0])
    const candleIndex = scenario.checkpoints[1] - 1
    const stopHits = [{ segment: 0, candleIndex, price: 98 }]
    expect(positionChangeCount(positionEvents(decisions, stopHits))).toBe(1)
    const markers = replayMarkers(scenario, decisions, [{ kind: 'stop', candleIndex, price: 98, exposure: 0 }], 1, scenario.candles.length)
    expect(markers.filter(m => m.candleIndex === candleIndex).map(m => m.text)).toEqual(['Стоп', '02'])
  })

  it('does not reveal future decisions during playback', () => {
    const decisions = decisionsFor([0, 0, 0])
    const markers = replayMarkers(scenario, decisions, [], null, scenario.checkpoints[0])
    expect(markers.map(m => m.text)).toEqual(['01'])
  })

  it('combines action, direction and fractional size without a fictitious size for a closed position', () => {
    expect(decisionTitle('reduce', -0.125)).toBe('Сокращение шорта · 12,5%')
    expect(decisionTitle('increase', 0.5)).toBe('Увеличение лонга · 50%')
    expect(decisionTitle('close', 0)).toBe('Закрытие позиции')
    expect(decisionTitle('flat', 0)).toBe('Вне рынка')
  })
})
