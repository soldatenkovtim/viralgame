/** Positions text boxes only; the underlying price lines keep their coordinates. */
export function layoutPriceLabels(entryY: number, currentY: number, entryHeight: number, currentHeight: number, paneHeight: number, merged = false): [number, number] {
  const clamp = (y: number, height: number) => Math.max(0, Math.min(paneHeight - height, y - height / 2))
  const a = clamp(entryY, entryHeight)
  const b = clamp(currentY, currentHeight)
  if (merged || a >= b + currentHeight + 4 || b >= a + entryHeight + 4) return [a, b]
  const entryAbove = entryY <= currentY
  const total = entryHeight + currentHeight + 4
  const top = Math.max(0, Math.min(paneHeight - total, (entryY + currentY) / 2 - total / 2))
  return entryAbove ? [top, top + entryHeight + 4] : [top + currentHeight + 4, top]
}
