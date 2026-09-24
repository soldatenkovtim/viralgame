import { createRandom } from '@/lib/random'
import type { BlindMarketScenario, Candle } from '@/types/game'

/**
 * Свечи генерируются из seed, а не хранятся как массив чисел.
 * Это даёт два свойства: сценарии дёшево редактировать (меняется форма фазы,
 * а не 76 строк данных) и любой игрок по shared-ссылке получает тот же рынок.
 */
interface PhaseShape {
  /** Количество свечей в фазе. */
  length: number
  /** Средний лог-дрейф на свечу. */
  drift: number
  /** Волатильность лог-доходности на свечу. */
  volatility: number
}

const VISIBLE_CANDLES = 40
const SEGMENT_CANDLES = 12
const BASE_TIME = Date.UTC(2021, 4, 17, 9, 0, 0) / 1000
const CANDLE_SECONDS = 60 * 60

function generateCandles(seed: number, startPrice: number, phases: PhaseShape[]): Candle[] {
  const random = createRandom(seed)
  const candles: Candle[] = []
  let price = startPrice
  let index = 0

  for (const phase of phases) {
    for (let i = 0; i < phase.length; i += 1) {
      const open = price
      const logReturn = random.normal(phase.drift, phase.volatility)
      const close = open * Math.exp(logReturn)

      // Тени: фитиль пропорционален телу и волатильности фазы.
      const body = Math.abs(close - open)
      const wickScale = phase.volatility * open
      const upperWick = Math.abs(random.normal(0, 0.55)) * wickScale + body * 0.18
      const lowerWick = Math.abs(random.normal(0, 0.55)) * wickScale + body * 0.18

      candles.push({
        time: BASE_TIME + index * CANDLE_SECONDS,
        open: round2(open),
        high: round2(Math.max(open, close) + upperWick),
        low: round2(Math.max(0.01, Math.min(open, close) - lowerWick)),
        close: round2(close),
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

const CHECKPOINTS = [
  VISIBLE_CANDLES,
  VISIBLE_CANDLES + SEGMENT_CANDLES,
  VISIBLE_CANDLES + SEGMENT_CANDLES * 2,
]

export const BLIND_VISIBLE_CANDLES = VISIBLE_CANDLES
export const BLIND_SEGMENT_CANDLES = SEGMENT_CANDLES
export const BLIND_TOTAL_CANDLES = VISIBLE_CANDLES + SEGMENT_CANDLES * 3

export const blindMarketScenarios: BlindMarketScenario[] = [
  {
    id: 'blind_01',
    title: 'Сжатие',
    seed: 730114,
    candles: generateCandles(730114, 142.4, [
      // Видимая часть: затухающая волатильность, рынок «поджимается».
      { length: 18, drift: -0.0016, volatility: 0.0092 },
      { length: 22, drift: 0.0004, volatility: 0.0041 },
      // Сегмент 1: ложный прокол вниз.
      { length: 12, drift: -0.0029, volatility: 0.0078 },
      // Сегмент 2: разворот и импульс вверх.
      { length: 12, drift: 0.0071, volatility: 0.0083 },
      // Сегмент 3: движение продолжается, но теряет скорость.
      { length: 12, drift: 0.0028, volatility: 0.0069 },
    ]),
    checkpoints: CHECKPOINTS,
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
    candles: generateCandles(481907, 88.7, [
      // Видимая часть: уверенный, ровный рост — выглядит как тренд.
      { length: 16, drift: 0.0021, volatility: 0.0055 },
      { length: 24, drift: 0.0064, volatility: 0.0071 },
      // Сегмент 1: рост продолжается, но фитили сверху растут.
      { length: 12, drift: 0.0033, volatility: 0.0112 },
      // Сегмент 2: резкий разворот вниз.
      { length: 12, drift: -0.0094, volatility: 0.0135 },
      // Сегмент 3: продолжение падения с попытками отскока.
      { length: 12, drift: -0.0038, volatility: 0.0121 },
    ]),
    checkpoints: CHECKPOINTS,
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
    candles: generateCandles(269533, 21.85, [
      // Видимая часть: широкий шумный боковик без направления.
      { length: 20, drift: 0.0012, volatility: 0.0138 },
      { length: 20, drift: -0.0014, volatility: 0.0146 },
      // Сегмент 1: резкий пролив.
      { length: 12, drift: -0.0061, volatility: 0.0169 },
      // Сегмент 2: столь же резкое восстановление.
      { length: 12, drift: 0.0058, volatility: 0.0161 },
      // Сегмент 3: снова шум, движение никуда не идёт.
      { length: 12, drift: -0.0004, volatility: 0.0154 },
    ]),
    checkpoints: CHECKPOINTS,
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
