import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { advancedArbitrageScenarios } from '@/data/advanced/scenarios'
import { getCrossArbitrageScenario } from '@/data/crossArbitrageScenarios'
import { TradeTicket } from './CrossArbitrageTerminal'
import { ARB_POSITION_SIZES, buildQuotePath, quoteStepAt } from './engine'
import { evaluateRound, formatEdge } from './scoring'

const callbacks = { onBuy() {}, onSell() {}, onSize() {}, onExecute() {}, onSkip() {} }
const standard = getCrossArbitrageScenario('arb_x_liquidity')

describe('Cross-arbitrage ticket', () => {
  it.each([standard, advancedArbitrageScenarios[0]])('matches the executed round on the same quote step for $id', scenario => {
    const decisionTimeMs = 4000
    const path = buildQuotePath(scenario)
    const quotes = path[quoteStepAt(decisionTimeMs, path.length, scenario.quoteStepMs)]
    for (const positionSize of ARB_POSITION_SIZES) {
      for (const [buy, sell] of [[quotes[0], quotes[1]], [quotes[1], quotes[0]]]) {
        const decision = { buyVenue: buy.venueId, sellVenue: sell.venueId, positionSize, decisionTimeMs, timedOut: false }
        const round = evaluateRound(scenario, decision)
        const html = renderToStaticMarkup(createElement(TradeTicket, { ...callbacks, ...decision, quotes }))
        expect(html).toContain(`>${formatEdge(round.capitalReturn * 100)}</strong>`)
        expect(html).toContain(`<dd>${formatEdge(-round.feeReturn! * 100)}</dd>`)
        expect(html).toContain(`<dd>${formatEdge(-round.slippageReturn! * 100)}</dd>`)
        expect(html).toContain('Изменение капитала раунда')
        expect(html).toContain(`Доходность сделки <b>${formatEdge(round.netReturn * 100)}</b>`)
        expect(html).toContain(round.liquidityHit ? 'Остаток исполнится' : 'Весь объём')
        expect(html).not.toMatch(/<button[^>]* disabled=""[^>]*>Исполнить сделку/)
      }
    }
  })
  it('explains insufficient depth and keeps skipping available', () => {
    const quotes = standard.quotes.map(q => ({ ...q, askLiquidity: 0, secondAskLiquidity: 0 }))
    const html = renderToStaticMarkup(createElement(TradeTicket, { ...callbacks, quotes, buyVenue: quotes[0].venueId, sellVenue: quotes[1].venueId, positionSize: 1 }))
    expect(html).toContain('недостаточно ликвидности')
    expect(html).not.toContain('Изменение капитала раунда')
    expect(html).toMatch(/<button[^>]* disabled=""[^>]*>Исполнить сделку/)
    expect(html).not.toMatch(/<button[^>]* disabled=""[^>]*>Сделки нет/)
  })
})
