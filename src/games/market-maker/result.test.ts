import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { PnlBreakdown } from './MarketMakerResult'
import { MarketMakerEngine } from './engine'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'

describe('result financial presentation', () => {
  it.each([false, true])('preserves accounting with hedging=%s', hedge => {
    const engine = new MarketMakerEngine(marketMakerScenarios[0])
    while (!engine.finished) { engine.tick(); if (hedge) engine.hedge() }
    const r = engine.buildResult()
    expect(r.spreadPnl + r.inventoryPnl - r.hedgeCosts - (r.transactionCosts ?? 0) - (r.carryCosts ?? 0)).toBeCloseTo(r.pnl)
    expect(r.realizedPnl! + r.unrealizedPnl! - r.hedgeCosts - (r.transactionCosts ?? 0) - (r.carryCosts ?? 0)).toBeCloseTo(r.pnl)
    if (!hedge) expect(r.phases.reduce((sum,p) => sum + p.pnlChange, 0)).toBeCloseTo(r.pnl)
    const html = renderToStaticMarkup(createElement(PnlBreakdown, { result:r }))
    expect(html).toContain('Подробнее о расчёте PnL')
    expect(html).not.toContain('PnL debug')
  })
  it.each([0, 815, -815])('shows %s with the correct sign, including missing optional accounting', pnl => {
    const r = new MarketMakerEngine(marketMakerScenarios[0]).buildResult()
    const html = renderToStaticMarkup(createElement(PnlBreakdown,{result:{...r,pnl, realizedPnl:undefined, unrealizedPnl:undefined}}))
    expect(html).toContain(pnl === 0 ? '>0</dd>' : pnl > 0 ? '>+815</dd>' : '>−815</dd>')
    expect(html).toContain('Альтернативная разбивка для этого прохождения не сохранена')
  })
})
