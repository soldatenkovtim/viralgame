import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getCrossArbitrageScenario } from '@/data/crossArbitrageScenarios'
import { TradeTicket } from './CrossArbitrageTerminal'
import { RoundFeedback } from './RoundFeedback'
import { evaluateRound, formatEdge } from './scoring'
import { roundPresentation } from './roundPresentation'
import { buildQuotePath, quoteStepAt } from './engine'

const trade = { buyVenue: 'alpha', sellVenue: 'beta', positionSize: 0.25, decisionTimeMs: 1000, timedOut: false }
const skip = { positionSize: 0, decisionTimeMs: 1000, timedOut: false }
const callbacks = { onBuy() {}, onSell() {}, onSize() {}, onExecute() {}, onSkip() {} }

describe('Round result presentation', () => {
  it.each([
    ['arb_btc_obvious', 0.25, 1000],
    ['arb_x_false', 1, 1000],
    ['arb_x_liquidity', 1, 1000],
    ['arb_eth_dynamic', 0.5, 6000],
  ] as const)('agrees with preview and actual execution for %s, size %s, time %s', (id, positionSize, decisionTimeMs) => {
    const scenario = getCrossArbitrageScenario(id)
    const decision = { ...trade, positionSize, decisionTimeMs }
    const path = buildQuotePath(scenario)
    const quotes = path[quoteStepAt(decisionTimeMs, path.length, scenario.quoteStepMs)]
    const round = evaluateRound(scenario, decision)
    const html = renderToStaticMarkup(createElement(RoundFeedback, { round, scenario, remainingMs: 1200, durationMs: 1500, finalRound: false }))
    const preview = renderToStaticMarkup(createElement(TradeTicket, { ...callbacks, ...decision, quotes }))
    const result = `>${formatEdge(round.capitalReturn * 100)}</strong>`
    expect(html).toContain(result)
    expect(preview).toContain(result)
    expect(html).toContain(`<dd>${formatEdge(round.netReturn * 100)}</dd>`)
    expect(html).toContain(`<dd>${formatEdge(-round.slippageReturn! * 100)}</dd>`)
    expect(html).toContain('Изменение капитала раунда')
    expect(html).toContain('Доходность сделки после издержек')
    expect(html).toContain('1,2')
    expect(html).not.toMatch(/Gross spread|Slippage|Net result|[Ee]dge/)
  })

  it('compares capital returns across sizes rather than ranking per-unit yields', () => {
    const scenario = getCrossArbitrageScenario('arb_x_multiple_liq')
    const small = evaluateRound(scenario, { ...trade, positionSize: 0.1 })
    const full = evaluateRound(scenario, { ...trade, buyVenue: 'gamma', positionSize: 1 })
    expect(small.netReturn).toBeGreaterThan(full.netReturn)
    expect(small.capitalReturn).toBeLessThan(full.capitalReturn)
    expect(roundPresentation(small, scenario).comparison).toMatchObject({ buyVenue: 'gamma', sellVenue: 'beta', positionSize: 1, capitalReturn: full.capitalReturn })
    expect(roundPresentation(full, scenario)).toMatchObject({ bestExecution: true, comparison: undefined })
  })

  it('distinguishes absent, available and expired opportunities', () => {
    const absent = getCrossArbitrageScenario('arb_x_none')
    expect(roundPresentation(evaluateRound(absent, skip), absent)).toMatchObject({
      observation: 'Прибыльных маршрутов после комиссий и издержек не было.', comparison: undefined,
    })
    const available = getCrossArbitrageScenario('arb_btc_obvious')
    expect(roundPresentation(evaluateRound(available, skip), available).comparisonMoment).toBe('В момент решения')
    const dynamic = getCrossArbitrageScenario('arb_eth_dynamic')
    const expired = roundPresentation(evaluateRound(dynamic, { ...skip, decisionTimeMs: 15000, timedOut: true }), dynamic)
    expect(expired.comparisonMoment).toBe('В начале раунда')
    expect(expired.observation).toContain('закрылась')
    expect(expired.comparison?.capitalReturn).toBeGreaterThan(0)
  })

  it('shows a neutral exact-zero execution and the final transition label', () => {
    const base = getCrossArbitrageScenario('arb_btc_obvious')
    const scenario = { ...base, quotes: base.quotes.map(q => ({ ...q, bid: 100, ask: 100, feeRate: 0 })) }
    const round = evaluateRound(scenario, trade)
    expect(round.capitalReturn).toBe(0)
    const html = renderToStaticMarkup(createElement(RoundFeedback, { round, scenario, remainingMs: 500, durationMs: 1500, finalRound: true }))
    expect(html).toContain('Сделка исполнена')
    expect(html).toContain('class="text-chalk-200">0,00%</strong>')
    expect(html).toContain('Результат испытания')
    expect(html).not.toContain('Следующий раунд')
  })

  it('uses the current quote step for comparisons without changing the initial scoring benchmark', () => {
    const scenario = getCrossArbitrageScenario('arb_eth_dynamic')
    const before = evaluateRound(scenario, { ...trade, positionSize: 1, decisionTimeMs: 2999 })
    const after = evaluateRound(scenario, { ...trade, positionSize: 1, decisionTimeMs: 3000 })
    expect(before.quoteStep).toBe(0)
    expect(after.quoteStep).toBe(1)
    expect(after.capitalReturn).toBeLessThan(before.capitalReturn)
    expect(after.optimalNetReturn).toBe(before.optimalNetReturn)
    expect(roundPresentation(after, scenario).bestExecution).toBe(true)
  })

  it('identifies timeouts without attributing an intentional skip', () => {
    const scenario = getCrossArbitrageScenario('arb_btc_obvious')
    const round = evaluateRound(scenario, { ...trade, sellVenue: undefined, timedOut: true, decisionTimeMs: 15000 })
    const html = renderToStaticMarkup(createElement(RoundFeedback, { round, scenario, remainingMs: 1500, durationMs: 1500, finalRound: false }))
    expect(html).toContain('Время вышло — сделка не совершена')
    expect(html).not.toContain('Средняя цена покупки')
    expect(html).toContain('Потенциальное изменение капитала раунда')
  })
})
