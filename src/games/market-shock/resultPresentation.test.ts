import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MarketShockResult } from './MarketShockResult'
import { MarketShockReplay } from './MarketShockReplay'
import { marketShockScenarios } from './scenarios'
import { legacyMarketShockScenarios } from './legacyScenarios'
import { decisionsFromActions, decisionCandleIndex, positionLabel, initialExposure } from './engine'
import { buildMarketShockResult } from './scoring'
import { decisionPosition, exposureSegments, sessionObservation, sourceLabel } from './resultPresentation'
import { formatPercent, formatNumber } from '@/lib/formatting'
import { scenarioPool } from '@/scenario-engine/selectScenario'
import { useGameStore } from '@/store/gameStore'
import type { ShockAction } from '@/types/game'

type ChartProps = Parameters<typeof import('@/components/charts/TradingChart').TradingChart>[0]
const chart = vi.hoisted(() => ({ props: {} as ChartProps }))
vi.mock('@/store/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('@/store/gameStore')>()
  return { ...actual, useGameStore: Object.assign((select: (s: ReturnType<typeof actual.useGameStore.getState>) => unknown) => select(actual.useGameStore.getState()), actual.useGameStore) }
})
vi.mock('@/components/charts/TradingChart', () => ({
  CHART_COLORS: { entry: '#aaa', up: '#0f0', down: '#f00' },
  TradingChart: (props: ChartProps) => { chart.props = props; return createElement('div', { 'data-chart': true }) },
}))
const scenario = marketShockScenarios[2]
const result = buildMarketShockResult(scenario, decisionsFromActions(scenario, ['hold', 'hedge', 'increase']), [])
const outcome = { points: 5814, previousBest: 6000, isPersonalBest: false, pointsToBest: 186, unlockedNext: 'cross-arbitrage' as const, seriesCompleted: false }
function render(value = result) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MarketShockResult, { scenario, result: value, outcome, nextHref: '/challenge/cross-arbitrage', nextLabel: 'Открыть последнее испытание' })))
}

describe('представление результатов Рыночного шока', () => {
  it.each([2.2, -2.2, 0])('показывает сохранённый итог %s без изменения данных', pnlPercent => {
    const value = { ...result, pnlPercent }
    const before = JSON.stringify(value)
    const html = render(value)
    expect(html).toContain(`Результат: ${formatPercent(pnlPercent)}`)
    expect(html).toContain(pnlPercent > 0 ? 'text-market-up' : pnlPercent < 0 ? 'text-market-down' : 'text-chalk-200')
    expect(JSON.stringify(value)).toBe(before)
    expect(html).toContain(formatNumber(outcome.points))
    expect(html).not.toContain('ПРОФИЛЬ ТРЕЙДЕРА')
  })
  it('показывает PnL в момент решения, включая старую историю без pnlAfter', () => {
    const value = { ...result, decisions: result.decisions.map(d => ({ ...d, pnlBefore: 12.3, pnlAfter: undefined })) }
    const html = render(value)
    expect(html.match(/\+12,3%/g)?.length).toBe(3)
    for (const field of [formatPercent(-result.maxDrawdown), `${Math.round(result.maxExposure * 100)}%`, `${Math.round(result.minExposure * 100)}%`]) expect(html).toContain(field)
  })
  it.each<ShockAction[]>([['hold', 'hold', 'hold'], ['hold', 'hedge', 'increase'], ['increase', 'hedge', 'close'], ['close']])('отражает фактические действия %s', (...actions) => {
    const value = buildMarketShockResult(scenario, decisionsFromActions(scenario, actions), [])
    const before = JSON.stringify(value)
    expect(sessionObservation(value, scenario)).toContain(formatPercent(value.maxDrawdown, 1, false))
    expect(sessionObservation(value, scenario).match(/\./g)?.length).toBe(3)
    expect(exposureSegments(scenario, value).at(-1)?.exposure).toBe(value.decisions.at(-1)?.positionAfter)
    if (actions.includes('close')) expect(render(value)).toContain('Вне рынка')
    expect(JSON.stringify(value)).toBe(before)
  })
  it('учитывает таймер и нулевой результат', () => {
    const value = { ...result, pnlPercent: 0, decisions: result.decisions.map(d => ({ ...d, timedOut: true, action: 'hold' as const, positionBefore: .6, positionAfter: .6 })) }
    expect(sessionObservation(value, scenario)).toContain('нулевым результатом')
    expect(sessionObservation(value, scenario)).toContain('не подтвержден')
    expect(render(value)).toContain('Время истекло. Позиция сохранена.')
  })
  it('сохраняет чистую экспозицию хеджа и временные пропорции', () => {
    expect(decisionPosition(result.decisions[1])).toBe('LONG 60% → LONG 21%')
    const segments = exposureSegments(scenario, result)
    expect(segments.map(s => s.exposure)).toEqual([.6, .21, .29])
    expect(segments[1].from).toBe(decisionCandleIndex(scenario, 2))
    expect(segments[0].from).toBe(scenario.initialVisibleIndex - 1)
    expect(segments.at(-1)?.to).toBe(scenario.candles.length - 1)
  })
  it.each([...marketShockScenarios, ...legacyMarketShockScenarios])('$id сохраняет рынок, источник и координаты выбранного решения', source => {
    const value = buildMarketShockResult(source, decisionsFromActions(source, ['hold', 'hedge', 'increase']), [])
    const select = vi.fn()
    renderToStaticMarkup(createElement(MarketShockReplay, { scenario: source, result: value, selectedDecision: 1, onSelectDecision: select }))
    expect(chart.props.focusCandleIndex).toBe(decisionCandleIndex(source, 2))
    expect(chart.props.candles).toBe(source.candles)
    expect(chart.props.entry?.label).toContain(positionLabel(initialExposure(source)))
    const markers = chart.props.markers!.filter((m: { id?: string }) => m.id)
    expect(markers.map((m: { text: string }) => m.text)).toEqual(['01', '02', '03'])
    chart.props.onMarkerSelect!('decision-2')
    expect(select).toHaveBeenCalledWith(2)
    expect(chart.props.separateEntryLabels).toBe(true)
  })
  it('не подменяет поставщика данных', () => {
    expect(sourceLabel('https://finance.yahoo.com/quote/NVDA')).toBe('Yahoo Finance')
    expect(sourceLabel('https://example.org/history')).toBe('example.org')
  })
  it.each(['standard', 'advanced'] as const)('%s поддерживает прогресс 1/3, 2/3 и 3/3 и пройденное следующее испытание', mode => {
    const state = useGameStore.getState()
    for (const completed of [1, 2, 3]) {
      const key = mode === 'advanced' ? 'advancedScenarioProgress' : 'scenarioProgress'
      // Advanced pools use different IDs. Read them through the same catalog as the UI.
      const ids = scenarioPool('black-swan', mode).map(s => s.id)
      useGameStore.setState({ selectedMode: mode, [key]: { ...state[key], 'black-swan': { ...state[key]['black-swan'], completedScenarioIds: ids.slice(0, completed) } }, completedChallenges: ['cross-arbitrage'], advancedResults: [{ challengeType: 'cross-arbitrage' } as ReturnType<typeof useGameStore.getState>['advancedResults'][number]] })
      const html = render()
      expect(html).toContain('Что дальше')
      expect(html).toContain(`Вы прошли ${completed} из 3`)
      expect(html).toContain('Вернуться к последнему испытанию')
      if (completed === 3) expect(html).toContain('Все сценарии этого испытания пройдены.')
    }
    useGameStore.setState(state)
  })
})

describe('аналитический смысл изменения экспозиции', () => {
  it.each([
    { actions: ['increase', 'increase', 'hold'], expected: ['увеличили длинную позицию с 60% до 100%', 'повысило чувствительность'] },
    { actions: ['hedge', 'hold', 'hold'], expected: ['до LONG 21% за счёт хеджирования', 'уменьшило чувствительность'] },
    { actions: ['hold', 'hedge', 'increase'], expected: ['от 21% до 60%', 'увеличение экспозиции повышало', 'сокращение снижало'] },
    { actions: ['hold', 'hold', 'hold'], expected: ['сохраняли экспозицию LONG 60%', 'размер позиции оставался прежним'] },
    { actions: ['increase', 'close'], expected: ['полностью закрыли исходную позицию', 'после закрытия дальнейшее движение рынка не влияло'] },
  ] as { actions: ShockAction[]; expected: string[] }[])('$actions объясняет изменение риска', ({ actions, expected }) => {
    const value = buildMarketShockResult(scenario, decisionsFromActions(scenario, actions), [])
    const before = JSON.stringify(value)
    const observation = sessionObservation(value, scenario).toLowerCase()
    for (const phrase of expected) expect(observation).toContain(phrase.toLowerCase())
    expect(JSON.stringify(value)).toBe(before)
  })
  it('учитывает короткую позицию и знак итогового результата', () => {
    const shortScenario = { ...scenario, initialPosition: { ...scenario.initialPosition, direction: 'short' as const } }
    const value = buildMarketShockResult(shortScenario, decisionsFromActions(shortScenario, ['increase', 'hold', 'hold']), [])
    expect(sessionObservation(value, shortScenario)).toContain('увеличили короткую позицию')
    for (const [pnlPercent, phrase] of [[2, 'прибылью 2,0%'], [-1, 'убытком 1,0%'], [0, 'нулевым результатом']] as const) {
      expect(sessionObservation({ ...value, pnlPercent }, shortScenario)).toContain(phrase)
    }
  })
  it('корректно описывает отсутствие позиции и таймер', () => {
    const emptyScenario = { ...scenario, initialPosition: { ...scenario.initialPosition, exposure: 0 } }
    const value = buildMarketShockResult(emptyScenario, [], [])
    expect(sessionObservation(value, emptyScenario)).toContain('оставались вне рынка')
    const timedOut = { ...result, decisions: result.decisions.map(d => ({ ...d, action: 'hold' as const, timedOut: true, positionBefore: .6, positionAfter: .6 })) }
    expect(sessionObservation(timedOut, scenario)).toContain('не подтверждена до истечения времени')
    expect(sessionObservation(timedOut, scenario)).toContain('сохраняли экспозицию')
  })
})
