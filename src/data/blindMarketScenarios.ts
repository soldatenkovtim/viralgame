import { createRandom } from '@/lib/random'
import type { BlindMarketScenario, OhlcvCandle } from '@/types/game'

/**
 * Свечи генерируются из seed, а не хранятся как массив чисел.
 * Это даёт два свойства: сценарии дёшево редактировать (меняется форма фазы,
 * а не тысячи строк данных) и любой игрок по shared-ссылке получает тот же рынок.
 *
 * Базовый таймфрейм — 15 минут. 1ч / 4ч / 1Д агрегируются из него на лету,
 * поэтому все таймфреймы всегда согласованы между собой.
 */
interface PhaseShape {
  /** Длительность фазы в часах. */
  hours: number
  /** Средний лог-дрейф за час. */
  drift: number
  /** Волатильность лог-доходности за час. */
  volatility: number
  /** Множитель объёма относительно базового. */
  volume: number
}

export const BLIND_BAR_SECONDS = 15 * 60
const BARS_PER_HOUR = 3600 / BLIND_BAR_SECONDS
const HISTORY_HOURS = 30 * 24
const SEGMENT_HOURS = 24

const HISTORY_BARS = HISTORY_HOURS * BARS_PER_HOUR
const SEGMENT_BARS = SEGMENT_HOURS * BARS_PER_HOUR

/** Полночь UTC: дневные и 4-часовые свечи выравниваются по началу данных. */
const BASE_TIME = Date.UTC(2021, 4, 1, 0, 0, 0) / 1000

function generateCandles(
  seed: number,
  startPrice: number,
  baseVolume: number,
  phases: PhaseShape[],
): OhlcvCandle[] {
  const random = createRandom(seed)
  const candles: OhlcvCandle[] = []
  let price = startPrice
  let index = 0

  for (const phase of phases) {
    const bars = phase.hours * BARS_PER_HOUR
    const drift = phase.drift / BARS_PER_HOUR
    const volatility = phase.volatility / Math.sqrt(BARS_PER_HOUR)

    for (let i = 0; i < bars; i += 1) {
      const time = BASE_TIME + index * BLIND_BAR_SECONDS
      const open = price
      const logReturn = random.normal(drift, volatility)
      const close = open * Math.exp(logReturn)

      // Тени: фитиль пропорционален телу и волатильности фазы.
      const body = Math.abs(close - open)
      const wickScale = volatility * open
      const upperWick = Math.abs(random.normal(0, 0.55)) * wickScale + body * 0.18
      const lowerWick = Math.abs(random.normal(0, 0.55)) * wickScale + body * 0.18

      // Объём: внутридневная сезонность, реакция на размер движения и шум.
      const hour = ((time % 86400) / 3600 + 24) % 24
      const seasonality = 1 + 0.35 * Math.cos((2 * Math.PI * (hour - 14)) / 24)
      const impulse = 0.55 + 0.9 * Math.min(Math.abs(logReturn) / volatility, 3)
      const noise = Math.exp(random.normal(0, 0.3))

      candles.push({
        time,
        open: round2(open),
        high: round2(Math.max(open, close) + upperWick),
        low: round2(Math.max(0.01, Math.min(open, close) - lowerWick)),
        close: round2(close),
        volume: Math.round(baseVolume * phase.volume * seasonality * impulse * noise),
      })

      price = close
      index += 1
    }
  }

  return candles
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const CHECKPOINTS = [HISTORY_BARS, HISTORY_BARS + SEGMENT_BARS, HISTORY_BARS + SEGMENT_BARS * 2]

export const BLIND_VISIBLE_CANDLES = HISTORY_BARS
export const BLIND_SEGMENT_CANDLES = SEGMENT_BARS
export const BLIND_TOTAL_CANDLES = HISTORY_BARS + SEGMENT_BARS * 3

export const blindMarketScenarios: BlindMarketScenario[] = [
  {
    id: 'blind_01',
    title: 'Сжатие',
    seed: 730114,
    candles: generateCandles(730114, 128.6, 4200, [
      // История: рост, откат и долгий боковик.
      { hours: 300, drift: 0.0004, volatility: 0.0085, volume: 1 },
      { hours: 200, drift: -0.0005, volatility: 0.008, volume: 0.95 },
      { hours: 124, drift: 0.0001, volatility: 0.0065, volume: 0.85 },
      // Перед входом: затухающая волатильность, рынок «поджимается».
      { hours: 56, drift: -0.0008, volatility: 0.006, volume: 0.75 },
      { hours: 40, drift: 0.0002, volatility: 0.003, volume: 0.55 },
      // Отрезок 1: ложный прокол вниз.
      { hours: 24, drift: -0.00145, volatility: 0.0055, volume: 1.5 },
      // Отрезок 2: разворот и импульс вверх.
      { hours: 24, drift: 0.0036, volatility: 0.006, volume: 2.2 },
      // Отрезок 3: движение продолжается, но теряет скорость.
      { hours: 24, drift: 0.0014, volatility: 0.005, volume: 1.2 },
    ]),
    checkpoints: CHECKPOINTS,
    asset: { name: 'JPMorgan Chase', ticker: 'JPM', exchange: 'NYSE' },
    reveal: {
      title: 'Сжатие волатильности перед выходом из диапазона',
      description:
        'Паттерн вдохновлён поведением ликвидного актива после длительного сужения диапазона: сначала рынок вытряхивает стопы ложным проколом вниз, и только потом идёт основное движение. Данные в прототипе стилизованы.',
    },
    info: {
      volume: '+184% к среднему за 20 дней',
      volatility: '0,6× относительно среднего значения',
      correlation: '0,21',
      marketContext: 'Индекс снижается третий день подряд',
      sector: 'Финансы',
    },
    crowd: [
      { label: 'Закрылись', percent: 46 },
      { label: 'Держали', percent: 31 },
      { label: 'Увеличили позицию', percent: 15 },
      { label: 'Перевернулись', percent: 8 },
    ],
  },
  {
    id: 'blind_02',
    title: 'Импульс',
    seed: 481907,
    candles: generateCandles(481907, 71.2, 9800, [
      // История: долгий нейтральный рынок, затем набирающий силу рост.
      { hours: 320, drift: 0.0001, volatility: 0.007, volume: 1 },
      { hours: 200, drift: 0.0006, volatility: 0.006, volume: 1.1 },
      { hours: 120, drift: 0.0011, volatility: 0.0048, volume: 1 },
      // Перед входом: уверенный рост на снижающемся объёме.
      { hours: 80, drift: 0.0025, volatility: 0.0055, volume: 0.7 },
      // Отрезок 1: рост продолжается, но фитили сверху растут.
      { hours: 24, drift: 0.0016, volatility: 0.008, volume: 0.6 },
      // Отрезок 2: резкий разворот вниз.
      { hours: 24, drift: -0.0047, volatility: 0.0095, volume: 2 },
      // Отрезок 3: продолжение падения с попытками отскока.
      { hours: 24, drift: -0.0019, volatility: 0.0085, volume: 1.4 },
    ]),
    checkpoints: CHECKPOINTS,
    asset: { name: 'NVIDIA', ticker: 'NVDA', exchange: 'NASDAQ' },
    reveal: {
      title: 'Затухающий импульс на перегретом рынке',
      description:
        'Стилизованная версия ситуации, когда тренд визуально выглядит сильным, но объём уже не подтверждает движение. Разворот происходит без явного новостного повода. Данные в прототипе стилизованы.',
    },
    info: {
      volume: '−37% к среднему за 20 дней',
      volatility: '1,4× относительно среднего значения',
      correlation: '0,78',
      marketContext: 'Широкий рынок уже неделю обновляет максимумы',
      sector: 'Технологии',
    },
    crowd: [
      { label: 'Держали', percent: 44 },
      { label: 'Увеличили позицию', percent: 27 },
      { label: 'Сократили', percent: 19 },
      { label: 'Перевернулись', percent: 10 },
    ],
  },
  {
    id: 'blind_03',
    title: 'Рваный диапазон',
    seed: 269533,
    candles: generateCandles(269533, 22.4, 61000, [
      // История: широкий шумный боковик без направления.
      { hours: 360, drift: -0.0005, volatility: 0.009, volume: 1 },
      { hours: 200, drift: -0.001, volatility: 0.01, volume: 1.1 },
      { hours: 80, drift: -0.0001, volatility: 0.0098, volume: 1.2 },
      { hours: 80, drift: -0.0014, volatility: 0.0103, volume: 1.3 },
      // Отрезок 1: резкий пролив.
      { hours: 24, drift: -0.003, volatility: 0.012, volume: 1.8 },
      // Отрезок 2: столь же резкое восстановление.
      { hours: 24, drift: 0.0029, volatility: 0.0114, volume: 1.7 },
      // Отрезок 3: снова шум, движение никуда не идёт.
      { hours: 24, drift: -0.0002, volatility: 0.0109, volume: 1.2 },
    ]),
    checkpoints: CHECKPOINTS,
    asset: { name: 'Freeport-McMoRan', ticker: 'FCX', exchange: 'NYSE' },
    reveal: {
      title: 'Высокая волатильность без направления',
      description:
        'Рынок, на котором амплитуда большая, а итоговое смещение близко к нулю. Такие участки чаще всего наказывают размер позиции, а не ошибку в направлении. Данные в прототипе стилизованы.',
    },
    info: {
      volume: '+61% к среднему за 20 дней',
      volatility: '2,3× относительно среднего значения',
      correlation: '−0,08',
      marketContext: 'Рынок ждёт решения по ставке в конце недели',
      sector: 'Сырьё',
    },
    crowd: [
      { label: 'Сократили', percent: 38 },
      { label: 'Закрылись', percent: 29 },
      { label: 'Держали', percent: 24 },
      { label: 'Увеличили позицию', percent: 9 },
    ],
  },
]

export function getBlindScenario(id?: string | null): BlindMarketScenario {
  if (id) {
    const found = blindMarketScenarios.find((scenario) => scenario.id === id)
    if (found) return found
  }
  return blindMarketScenarios[0]
}

/** Выбор сценария по номеру попытки — при реплее рынок меняется. */
export function pickBlindScenario(attempt: number): BlindMarketScenario {
  return blindMarketScenarios[attempt % blindMarketScenarios.length]
}
