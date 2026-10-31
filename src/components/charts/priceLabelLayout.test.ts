import { describe, expect, it } from 'vitest'
import { layoutPriceLabels } from './priceLabelLayout'

describe('preparation price labels', () => {
  it('keeps separate prices centered when there is space', () => {
    expect(layoutPriceLabels(100, 200, 24, 24, 400)).toEqual([88, 188])
  })
  it('separates nearby labels in both price directions using measured heights', () => {
    for (const [entry, current] of [[100, 102], [102, 100], [0, 1], [399, 398]]) {
      const [a, b] = layoutPriceLabels(entry, current, 24, 30, 400)
      expect(a + 24 + 4 <= b || b + 30 + 4 <= a).toBe(true)
      expect(Math.min(a, b)).toBeGreaterThanOrEqual(0)
      expect(Math.max(a + 24, b + 30)).toBeLessThanOrEqual(400)
    }
  })
  it('centers the single merged label without an artificial offset', () => {
    expect(layoutPriceLabels(100, 100, 24, 0, 400, true)[0]).toBe(88)
  })
})
