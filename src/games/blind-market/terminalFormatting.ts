import { formatPercent } from '@/lib/formatting'

/** Display capital return without rounding a small loss or gain to zero. */
export function formatTerminalReturn(percent: number): string {
  const digits = percent === 0 ? 2 : Math.min(10, Math.max(2, -Math.floor(Math.log10(Math.abs(percent)))))
  return formatPercent(percent, digits)
}

export function formatPositionSize(exposure: number): string {
  return formatPercent(Math.abs(exposure) * 100, 2, false, 0)
}

export function formatPositionLabel(exposure: number): string {
  if (exposure === 0) return 'Вне рынка'
  return `${exposure > 0 ? 'Лонг' : 'Шорт'} ${formatPositionSize(exposure)}`
}
