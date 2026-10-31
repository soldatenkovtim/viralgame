import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketShockDecisionPanel, PositionSummary } from './MarketShockDecisionPanel'

const base = { phaseNumber: 2, position: 0.6, deciding: true, remaining: 18, timerDisabled: false, selected: null, onSelect: () => {}, onConfirm: () => {} }
describe('active shock presentation', () => {
  it.each([1, 2, 3])('preserves all controls in decision %s', phaseNumber => {
    const html = renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, phaseNumber, selected: 'hedge', notice: 'Решение исполнено: Хеджировать. SHORT 21%.' }))
    expect(html).toContain(`Решение 0${phaseNumber} из 03`)
    expect((html.match(/aria-pressed=/g) ?? []).length).toBe(4)
    expect(html).toContain('Подтвердить решение')
    expect(html).toContain('SHORT 21%')
  })
  it.each([20, 18, 10, 5, 1, 0, -1])('renders bounded countdown at %s', remaining => {
    const html = renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, remaining: remaining, }))
    expect(html).toContain(`aria-valuenow="${Math.max(0, remaining)}"`)
    expect(html).toContain(remaining <= 5 ? 'text-market-down' : remaining <= 10 ? 'text-amber-400' : 'text-violet-accent')
  })
  it('disables confirmation until a choice is made, and while the market moves', () => {
    const html = renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, }))
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Подтвердить решение/)
    const pending = renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, deciding: false, selected: 'close', }))
    expect((pending.match(/disabled=""/g) ?? []).length).toBe(5)
    expect(pending).toContain('Отсчёт не идёт')
  })
  it.each(['close', 'hedge', 'hold', 'increase'] as const)('marks selected %s and enables confirmation', selected => {
    const html = renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, selected: selected, }))
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect(html).not.toContain('disabled=""')
  })
  it('shows actual short hedge exposure and the position limit', () => {
    expect(renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, position: -0.6, }))).toContain('Экспозиция: SHORT 21%')
    expect(renderToStaticMarkup(createElement(MarketShockDecisionPanel, { ...base, position: 1, }))).toContain('Достигнут лимит позиции')
  })
  it('renders the closed position without a stale direction', () => {
    const html = renderToStaticMarkup(createElement(PositionSummary, { position: 0, pnlPercent: 0, entryPrice: 100, price: 100, }))
    expect(html).toContain('Вне рынка')
    expect(html).not.toContain('LONG')
    expect(html).not.toContain('SHORT')
  })
})
