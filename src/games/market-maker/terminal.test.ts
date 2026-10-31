import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InventoryCard, RecentTrades, Controls, RoundTimer, PnlCard } from './MarketMakerGame'
import { compactTradeMarkers } from '@/components/charts/QuoteChart'
import { MarketMakerEngine } from './engine'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import type { MMTrade } from '@/types/game'

const inventory = (value: number, softLimit = 15) => renderToStaticMarkup(createElement(InventoryCard, { inventory: value, softLimit }))

describe('market maker terminal presentation', () => {
  it.each([[0, 'лотов'], [1, 'лот'], [-2, 'лота'], [5, 'лотов'], [11, 'лотов'], [21, 'лот'], [-22, 'лота']])('shows units for %s lots', (value, unit) => {
    expect(inventory(value)).toContain(`>${unit}</span>`)
  })

  it.each([[-16, 'высокий'], [-15, 'средний'], [-14, 'средний'], [0, 'низкий'], [14, 'средний'], [15, 'средний'], [16, 'высокий'], [26, 'высокий']])('preserves risk boundary at %s', (value, status) => {
    expect(inventory(value)).toContain(`>${status}</span>`)
  })

  it('uses scenario thresholds at their actual positions on the wider scale', () => {
    const html = inventory(11, 10)
    expect(html).toContain('>высокий</span>')
    expect(html).toContain('Пороги повышенного риска: −10 и +10 лотов')
    expect(html).toContain('Диапазон шкалы: от −30 до +30')
    expect(html).toContain('>−10</span>')
    expect(html).toContain('>+10</span>')
    expect(inventory(15)).toContain('left:75%')
    expect(inventory(-15)).toContain('left:25%')
    expect(inventory(0)).toContain('left:50%')
  })

  it('describes real client fills and their signed position changes', () => {
    const engine = new MarketMakerEngine(marketMakerScenarios[0])
    while (!engine.finished) engine.tick()
    const trades = engine.snapshot().trades
    for (const side of ['buy', 'sell'] as const) {
      const trade = trades.find(t => t.botSide === side)!
      expect(trade).toBeDefined()
      const before = trades[trades.indexOf(trade) - 1]?.inventoryAfter ?? 0
      expect(trade.inventoryAfter - before).toBe(side === 'buy' ? -trade.size : trade.size)
      const html = renderToStaticMarkup(createElement(RecentTrades, { trades: [trade] }))
      expect(html).toContain(side === 'buy' ? 'по вашей Ask. Ваш инвентарь уменьшился' : 'по вашей Bid. Ваш инвентарь увеличился')
      expect(html).toContain('title="Клиент')
    }
  })

  it('keeps a reserved list area even with no fills', () => {
    const html = renderToStaticMarkup(createElement(RecentTrades, { trades: [] as MMTrade[] }))
    expect(html).toContain('Пока нет исполненных заявок')
    expect(html).toContain('mm-trade-list')
    expect(html).toContain('--mm-trade-rows:4')
    expect(html).not.toContain('<li ')
  })

  it('shows the actual dynamic hedge fee and retains disabled state when flat', () => {
    const engine = new MarketMakerEngine(marketMakerScenarios[0])
    const render = () => {
      const s = engine.snapshot()
      const noop = () => {}
      return renderToStaticMarkup(createElement(Controls, {
        onLower: noop, onHigher: noop, onNarrow: noop, onWiden: noop, onHedge: noop,
        hedgeDisabled: s.inventory === 0, hedgeCost: s.hedgeCostPreview, spread: s.spread,
      }))
    }
    expect(render()).toContain('Стоимость хеджа: —')
    expect(render()).toContain('disabled=""')
    while (!engine.snapshot().inventory && !engine.finished) engine.tick()
    const before = engine.snapshot()
    expect(render()).toContain(`Стоимость хеджа: ${before.hedgeCostPreview} ед.`)
    expect(render()).not.toContain('disabled=""')
    engine.hedge()
    expect(engine.snapshot().pnl).toBeCloseTo(before.pnl - before.hedgeCostPreview)
    expect(render()).toContain('disabled=""')
  })
})


describe('terminal dynamic boundaries', () => {
  it.each([[60, 'normal'], [16, 'normal'], [15, 'normal'], [11, 'normal'], [10, 'warning'], [7, 'warning'], [6, 'warning'], [5, 'critical'], [2, 'critical'], [0, 'critical']])('timer at %s seconds is %s', (secondsLeft, urgency) => {
    const html = renderToStaticMarkup(createElement(RoundTimer, { secondsLeft, progress: (60 - secondsLeft) / 60 }))
    expect(html).toContain(`data-urgency="${urgency}"`)
    expect(html).toContain('role="timer"')
  })

  it.each([[0, '0', 'text-chalk-200'], [-0, '0', 'text-chalk-200'], [0.49, '0', 'text-chalk-200'], [-0.49, '0', 'text-chalk-200'], [630.2, '+630', 'text-market-up'], [-630.2, '−630', 'text-market-down']])('formats PnL %s with a matching sign and color', (value, text, color) => {
    const html = renderToStaticMarkup(createElement(PnlCard, { value }))
    expect(html).toContain(color)
    expect(html).toContain(`>${text}</span>`)
  })

  it('limits overflowing history to the newest four fills without mutating it', () => {
    const engine = new MarketMakerEngine(marketMakerScenarios[0])
    while (engine.snapshot().trades.length < 6 && !engine.finished) engine.tick()
    const trades = engine.snapshot().trades
    expect(trades.length).toBeGreaterThanOrEqual(6)
    for (const count of [4, 5, 6]) {
      const source = trades.slice(0, count)
      const original = [...source]
      const html = renderToStaticMarkup(createElement(RecentTrades, { trades: source }))
      expect(html.match(/<li /g)).toHaveLength(4)
      expect(source).toEqual(original)
      const firstRow = html.slice(html.indexOf('<li '), html.indexOf('</li>'))
      const newest = source.at(-1)!
      expect(firstRow).toContain(`Лотов: </span>${newest.size}`)
      expect(firstRow).toContain(newest.botSide === 'buy' ? 'Купили' : 'Продали')
    }
  })

  it('retains both quote sides and the newest fill when chart markers crowd together', () => {
    const trade = { tick: 1, botSide: 'buy', price: 100, size: 1, inventoryAfter: -1, increasedRisk: true } as MMTrade
    const trades = [trade, { ...trade, tick: 2 }, { ...trade, tick: 2, botSide: 'sell' as const }, { ...trade, tick: 12 }]
    expect(compactTradeMarkers(trades, 120, 240)).toEqual(trades.slice(1))
    expect(compactTradeMarkers(trades, 120, 1200)).toEqual(trades)
  })

  it.each([0.2, 2])('disables only the unavailable spread direction at %s', spread => {
    const noop = () => {}
    const html = renderToStaticMarkup(createElement(Controls, { onLower: noop, onHigher: noop, onNarrow: noop, onWiden: noop, onHedge: noop, hedgeDisabled: false, hedgeCost: 100, spread }))
    const buttons = html.match(/<button[^>]*>/g)!
    expect(buttons[2].includes('disabled')).toBe(spread === 0.2)
    expect(buttons[3].includes('disabled')).toBe(spread === 2)
  })
})
