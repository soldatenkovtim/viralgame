import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InventoryCard, RecentTrades, Controls } from './MarketMakerGame'
import { MarketMakerEngine } from './engine'
import { marketMakerScenarios } from '@/data/marketMakerScenarios'
import type { MMTrade } from '@/types/game'

const inventory = (value: number, softLimit = 15) => renderToStaticMarkup(createElement(InventoryCard, { inventory: value, softLimit }))

describe('market maker terminal presentation', () => {
  it.each([[0, 'лотов'], [1, 'лот'], [-2, 'лота'], [5, 'лотов'], [11, 'лотов'], [21, 'лот'], [-22, 'лота']])('shows units for %s lots', (value, unit) => {
    expect(inventory(value)).toContain(`>${unit}</span>`)
  })

  it.each([[-16, 'повышенный'], [-15, 'умеренный'], [-14, 'умеренный'], [0, 'низкий'], [14, 'умеренный'], [15, 'умеренный'], [16, 'повышенный'], [26, 'сверх лимита']])('preserves risk boundary at %s', (value, status) => {
    expect(inventory(value)).toContain(`>${status}</span>`)
  })

  it('uses scenario thresholds at their actual positions on the wider scale', () => {
    const html = inventory(11, 10)
    expect(html).toContain('>повышенный</span>')
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
