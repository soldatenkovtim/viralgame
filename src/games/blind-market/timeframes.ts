import type { OhlcvCandle } from '@/types/game'

export type TimeframeId = '15m' | '1h' | '4h' | '1d'

export interface Timeframe {
  id: TimeframeId
  label: string
  seconds: number
  /** Сколько свечей видно при переключении на таймфрейм. */
  defaultBars: number
}

export const TIMEFRAMES: Timeframe[] = [
  { id: '15m', label: '15м', seconds: 15 * 60, defaultBars: 140 },
  { id: '1h', label: '1ч', seconds: 60 * 60, defaultBars: 110 },
  { id: '4h', label: '4ч', seconds: 4 * 60 * 60, defaultBars: 90 },
  { id: '1d', label: '1Д', seconds: 24 * 60 * 60, defaultBars: 40 },
]

export const DEFAULT_TIMEFRAME: TimeframeId = '1h'

export function getTimeframe(id: TimeframeId): Timeframe {
  return TIMEFRAMES.find((timeframe) => timeframe.id === id) ?? TIMEFRAMES[1]
}

/**
 * Собирает свечи старшего таймфрейма из первых `count` базовых свечей.
 * Последняя свеча может быть незавершённой — ровно как в живом терминале:
 * будущие базовые свечи в агрегацию не попадают никогда.
 */
export function aggregateCandles(
  candles: OhlcvCandle[],
  count: number,
  seconds: number,
): OhlcvCandle[] {
  const limit = Math.min(count, candles.length)
  if (limit <= 0) return []

  const origin = candles[0].time
  const result: OhlcvCandle[] = []
  let current: OhlcvCandle | null = null

  for (let i = 0; i < limit; i += 1) {
    const candle = candles[i]
    const bucket = origin + Math.floor((candle.time - origin) / seconds) * seconds

    if (!current || current.time !== bucket) {
      current = { ...candle, time: bucket }
      result.push(current)
      continue
    }

    current.high = Math.max(current.high, candle.high)
    current.low = Math.min(current.low, candle.low)
    current.close = candle.close
    current.volume += candle.volume
  }

  return result
}

/** Время начала свечи таймфрейма, в которую попадает момент `time`. */
export function bucketStart(time: number, origin: number, seconds: number): number {
  return origin + Math.floor((time - origin) / seconds) * seconds
}

/**
 * Данные идут без пропусков, поэтому время линейно переводится в логический
 * индекс бара. Центр бара — целый индекс, границы — ±0,5.
 */
export function timeToLogical(time: number, origin: number, seconds: number): number {
  return (time - origin) / seconds - 0.5
}

export function logicalToTime(logical: number, origin: number, seconds: number): number {
  return origin + (logical + 0.5) * seconds
}

/** Середина базовой свечи — туда ставятся точки решений в разметке. */
export function candleMidTime(candle: OhlcvCandle, baseSeconds: number): number {
  return candle.time + baseSeconds / 2
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/** Номер дня сессии вместо календарной даты — дата должна оставаться скрытой. */
export function sessionDay(time: number, origin: number): number {
  return Math.floor((time - origin) / 86400) + 1
}

export function formatClock(time: number): string {
  const date = new Date(time * 1000)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export function formatSessionTime(time: number, origin: number, withClock = true): string {
  const day = `День ${sessionDay(time, origin)}`
  return withClock ? `${day}, ${formatClock(time)}` : day
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн`
  if (value >= 10_000) return `${(value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`
  return value.toLocaleString('ru-RU')
}
