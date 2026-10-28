import { describe, expect, it } from 'vitest'
import { LANDSCAPE_PERIOD, landscapeFrame, projectLandscape } from './marketLandscapeDrawing'

describe('market landscape', () => {
  it('returns to the identical geometry, colours and signals after twelve seconds', () => {
    expect(landscapeFrame(LANDSCAPE_PERIOD)).toEqual(landscapeFrame(0))
    expect(landscapeFrame(3200 + LANDSCAPE_PERIOD)).toEqual(landscapeFrame(3200))
    expect(landscapeFrame(3200)).not.toEqual(landscapeFrame(0))
  })

  it('keeps all 81 connected terraces above the foundation and inside the canvas', () => {
    for (let time = 0; time <= LANDSCAPE_PERIOD; time += 100) {
      const cells = landscapeFrame(time)
      expect(cells).toHaveLength(81)
      for (const { x, y, height, accent } of cells) {
        expect(height).toBeGreaterThan(0)
        expect(accent).toBeGreaterThanOrEqual(0)
        expect(accent).toBeLessThanOrEqual(1)
        for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          const point = projectLandscape(x + dx, y + dy, height)
          expect(point[0]).toBeGreaterThan(20)
          expect(point[0]).toBeLessThan(600)
          expect(point[1]).toBeGreaterThan(20)
          expect(point[1]).toBeLessThan(520)
        }
      }
    }
  })

  it('moves smoothly through the loop boundary without a jump in speed', () => {
    const before = landscapeFrame(LANDSCAPE_PERIOD - 1)
    const start = landscapeFrame(0)
    const after = landscapeFrame(1)
    start.forEach((cell, index) => {
      expect(Math.abs(after[index].height - before[index].height)).toBeLessThan(.04)
      expect(after[index].height - cell.height).toBeCloseTo(cell.height - before[index].height, 4)
    })
  })
})
