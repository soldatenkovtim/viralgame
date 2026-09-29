import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarketShockChart } from './MarketShockChart'
import { MarketShockReplay } from './MarketShockReplay'
import { marketShockScenarios } from './scenarios'
import { legacyMarketShockScenarios } from './legacyScenarios'
import { buildMarketShockResult } from './scoring'
import { holdDecisions } from './engine'

vi.mock('@/components/charts/TradingChart', () => ({
  TradingChart: ({ showDates }: { showDates?: boolean }) => createElement('div', { 'data-axis': showDates ? 'calendar' : 'anonymous' }),
  CHART_COLORS: { entry: '#aaa', up: '#0f0', down: '#f00' },
}))

describe('таймфреймы и раскрытие дат в Рыночном шоке', () => {
  it.each(marketShockScenarios)('$id: минуты и часы доступны во время игры, даты скрыты', scenario => {
    expect(scenario.baseTimeframe).toBe('15m')
    const html = renderToStaticMarkup(createElement(MarketShockChart, { scenario, visibleCount: scenario.initialVisibleIndex, position: 0.6, levels: [] }))
    for (const label of ['15м', '1ч', '4ч', '1Д']) expect(html).toContain(`>${label}</button>`)
    expect(html).toContain('data-axis="anonymous"')
  })

  it.each([...marketShockScenarios, ...legacyMarketShockScenarios])('$id: итоговый разбор всегда раскрывает даты, включая старые результаты', scenario => {
    const result = buildMarketShockResult(scenario, holdDecisions(scenario), [])
    const html = renderToStaticMarkup(createElement(MarketShockReplay, { scenario, result }))
    expect(html).toContain('data-axis="calendar"')
  })
})
