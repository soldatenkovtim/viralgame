import { expect, it } from 'vitest'
import { CAPITAL } from '@/lib/constants'
import { applyAction } from './scoring'
import { formatPositionLabel, formatPositionSize, formatTerminalReturn } from './terminalFormatting'

it.each([-332, 332, -40, 40, -1, 1])('preserves the sign of a small capital PnL: %s', pnl => {
  const result = formatTerminalReturn(pnl / CAPITAL * 100)
  expect(result.startsWith(pnl < 0 ? '-' : '+')).toBe(true)
  expect(Number(result.replace('%', '').replace(',', '.'))).not.toBe(0)
})

it('formats capital return, including unsigned zero', () => {
  expect(formatTerminalReturn(-332 / CAPITAL * 100)).toBe('-0,03%')
  expect(formatTerminalReturn(332 / CAPITAL * 100)).toBe('+0,03%')
  expect(formatTerminalReturn(0)).toBe('0,00%')
  expect(formatTerminalReturn(-0)).toBe('0,00%')
})

it('shows the actual rounded reduction without changing the trading rule', () => {
  expect(formatPositionLabel(applyAction(.25, 'reduce'))).toBe('Лонг 13%')
  expect(formatPositionLabel(applyAction(-.25, 'reduce'))).toBe('Шорт 12%')
  expect(formatPositionLabel(applyAction(.5, 'reduce'))).toBe('Лонг 25%')
  expect(formatPositionLabel(applyAction(.25, 'close'))).toBe('Вне рынка')
  expect(formatPositionLabel(applyAction(.25, 'flip'))).toBe('Шорт 25%')
  expect(formatPositionLabel(applyAction(.25, 'increase'))).toBe('Лонг 50%')
})

it('preserves fractional position sizes if supplied by the engine', () => {
  expect(formatPositionSize(.125)).toBe('12,5%')
  expect(formatPositionLabel(-.125)).toBe('Шорт 12,5%')
  expect(formatPositionSize(.25)).toBe('25%')
})
