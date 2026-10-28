import { expect, it } from 'vitest'
import { formatPercent } from './formatting'

it.each([0, -0, -0.0001, 0.0001, -0.049, 0.049])('renders %s as unsigned zero at one decimal place', value => {
  expect(formatPercent(value)).toBe('0,0%')
  expect(formatPercent(value, 1, false)).toBe('0,0%')
})

it.each([
  [-0.05, 1, '-0,1%'], [0.05, 1, '+0,1%'],
  [-0.0049, 2, '0,00%'], [0.0049, 2, '0,00%'],
  [-0.005, 2, '-0,01%'], [0.005, 2, '+0,01%'],
  [-0.49, 0, '0%'], [0.49, 0, '0%'],
  [-0.5, 0, '-1%'], [0.5, 0, '+1%'],
] as const)('uses display precision when formatting %s with %s digits', (value, digits, expected) => {
  expect(formatPercent(value, digits)).toBe(expected)
})

it('preserves nonzero formatting and the optional positive sign', () => {
  expect(formatPercent(-4.8)).toBe('-4,8%')
  expect(formatPercent(4.8)).toBe('+4,8%')
  expect(formatPercent(4.8, 1, false)).toBe('4,8%')
  expect(formatPercent(-4.8, 1, false)).toBe('-4,8%')
})
