import type { IChartApi, ISeriesApi } from 'lightweight-charts'

const tokens = {
  up: '--success', down: '--error', grid: '--chart-grid', border: '--border',
  text: '--muted', level: '--ink-500', selected: '--accent', trend: '--accent-soft',
  stop: '--error', entry: '--muted', market: '--chalk-200', surface: '--surface',
}
const fallback = {
  up: '#047857', down: '#be123c', grid: '#e1e1db', border: '#d4d4ce',
  text: '#666661', level: '#8c8c85', selected: '#7741c8', trend: '#6531b2',
  stop: '#be123c', entry: '#666661', market: '#3f3f42', surface: '#eeeee9',
}
type Palette = typeof fallback
let cachedTheme: string | undefined
let cached: Palette = fallback

function palette(): Palette {
  if (typeof document === 'undefined') return fallback
  const theme = document.documentElement.dataset.theme ?? 'system'
  if (cachedTheme !== theme) {
    const style = getComputedStyle(document.documentElement)
    cached = { ...fallback }
    for (const key of Object.keys(tokens) as (keyof Palette)[]) {
      cached[key] = style.getPropertyValue(tokens[key]).trim() || fallback[key]
    }
    cachedTheme = theme
  }
  return cached
}

// Getters keep pointer handlers and canvas renderers in sync without recreating charts.
export const CHART_COLORS = Object.defineProperties({} as Palette,
  Object.fromEntries(Object.keys(tokens).map(key => [key, {
    enumerable: true, get: () => palette()[key as keyof Palette],
  }])),
)

/** Also recolor annotations created before a theme switch. */
export function themedAnnotation(color: string) {
  const roles: Record<string, keyof Palette> = {
    '#16815a': 'up', '#047857': 'up', '#34d399': 'up',
    '#c6384a': 'down', '#be123c': 'down', '#fb7185': 'down',
    '#7741c8': 'selected', '#b589ef': 'selected',
    '#6531b2': 'trend', '#c6a3f4': 'trend',
    '#666661': 'text', '#a2a2ad': 'text', '#8a8a99': 'level',
  }
  return roles[color] ? CHART_COLORS[roles[color]] : color
}

export function applyChartTheme(chart: IChartApi, candles?: ISeriesApi<'Candlestick'> | null) {
  const c = CHART_COLORS
  chart.applyOptions({
    layout: { textColor: c.text },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border },
    crosshair: {
      vertLine: { color: c.level, labelBackgroundColor: c.selected },
      horzLine: { color: c.level, labelBackgroundColor: c.selected },
    },
  })
  candles?.applyOptions({
    upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down,
    wickUpColor: c.up, wickDownColor: c.down, priceLineColor: c.text,
  })
}
