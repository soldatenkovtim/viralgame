const RU = 'ru-RU'

/** Проценты в русском формате: +4,8% */
export function formatPercent(value: number, digits = 1, withSign = true): string {
  if (Object.is(value, -0)) value = 0
  const formatted = value.toLocaleString(RU, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (!withSign || value < 0) return `${formatted}%`
  return `+${formatted}%`
}

/** Денежная величина без валюты: +48 000 */
export function formatMoney(value: number, withSign = true): string {
  const rounded = Math.round(value)
  const formatted = Math.abs(rounded).toLocaleString(RU)
  if (rounded < 0) return `−${formatted}`
  return withSign ? `+${formatted}` : formatted
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(RU, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Цена котировки: 99,60 */
export function formatPrice(value: number, digits = 2): string {
  return value.toLocaleString(RU, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatSigned(value: number, digits = 0): string {
  const formatted = formatNumber(Math.abs(value), digits)
  if (value < 0) return `−${formatted}`
  if (value > 0) return `+${formatted}`
  return formatted
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString(RU, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} с`
}

/** Цвет под знак значения. Зелёный и красный — только для рыночных величин. */
export function pnlColor(value: number): string {
  if (value > 0) return 'text-market-up'
  if (value < 0) return 'text-market-down'
  return 'text-chalk-200'
}

export function exposureLabel(exposure: number): string {
  if (exposure === 0) return 'Вне рынка'
  const side = exposure > 0 ? 'Лонг' : 'Шорт'
  return `${side} ${Math.round(Math.abs(exposure) * 100)}%`
}

/** Правильная форма русского существительного для числительного. */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}
