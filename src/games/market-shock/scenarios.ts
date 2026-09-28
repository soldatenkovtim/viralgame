import { getTimeframe } from '@/games/blind-market/timeframes'
import { createRandom, type SeededRandom } from '@/lib/random'
import type {
  MarketShockPhase,
  MarketShockScenario,
  OhlcvCandle,
  PositionDirection,
  ShockAction,
  ShockCrowd,
  ShockPattern,
  ShockPreStructure,
} from '@/types/game'
import type { TimeframeId } from '@/games/blind-market/timeframes'

/** Понедельник, 00:00 UTC. Календарная дата наружу не выводится. */
const BASE_TIME = Date.UTC(2021, 0, 4) / 1000
/** Сколько свечей основного таймфрейма видно на экране при открытии. */
export const SHOCK_VISIBLE_BARS = 60
/** Окно истории, относительно которого считаются метрики фаз. */
const METRIC_WINDOW = 240

const ALL_ACTIONS: ShockAction[] = ['close', 'hedge', 'hold', 'increase']

/**
 * Кусок ценового пути. С `move` путь точно приходит к заданному изменению,
 * без него — блуждает с возвратом к стартовому уровню (боковик).
 */
interface Segment {
  bars: number
  /** Итоговое изменение за сегмент, % (включая гэп). */
  move?: number
  /** Стандартное отклонение доходности бара, %. */
  vol: number
  volume?: number
  /** Разрыв на открытии первого бара, %. */
  gap?: number
  revert?: number
  upperWick?: number
  lowerWick?: number
  /** Где сосредоточено движение: равномерно, в начале или в конце. */
  shape?: 'linear' | 'front' | 'back'
}

interface ScenarioSpec {
  id: string
  seed: number
  pattern: ShockPattern
  preStructure: ShockPreStructure
  assetHiddenName: string
  revealAsset: string
  revealPeriod: string
  revealEvent: string
  revealDescription: string
  primaryTimeframe: TimeframeId
  contextTimeframe: TimeframeId
  baseVolume: number
  currentPrice: number
  position: { direction: PositionDirection; exposure: number; entryPrice: number }
  contextVolatility: string
  history: Segment[]
  phases: [Segment[], Segment[], Segment[]]
  aftermath: Segment[]
  liquidity: [number, number, number]
  descriptions: [string, string, string]
  crowd: [ShockCrowd, ShockCrowd, ShockCrowd]
}

function shapeWeights(bars: number, shape: Segment['shape']): number[] {
  return Array.from({ length: bars }, (_, i) => {
    if (shape === 'front') return bars - i
    if (shape === 'back') return i + 1
    return 1
  })
}

function appendSegment(
  candles: OhlcvCandle[],
  segment: Segment,
  random: SeededRandom,
  baseVolume: number,
  barSeconds: number,
): void {
  const vol = segment.vol / 100
  const noise = Array.from({ length: segment.bars }, () => random.normal(0, vol))
  const gapLog = segment.gap ? Math.log(1 + segment.gap / 100) : 0

  let drift: number[] | null = null
  if (segment.move !== undefined) {
    const target = Math.log(1 + segment.move / 100) - gapLog
    const noiseSum = noise.reduce((sum, value) => sum + value, 0)
    const weights = shapeWeights(segment.bars, segment.shape)
    const weightSum = weights.reduce((sum, value) => sum + value, 0)
    drift = weights.map((weight) => ((target - noiseSum) * weight) / weightSum)
  }

  const anchor = Math.log(candles.at(-1)?.close ?? 100)
  const volumeScale = segment.volume ?? 1

  for (let i = 0; i < segment.bars; i += 1) {
    const previous = candles.at(-1)
    const prevClose = previous?.close ?? 100
    const open = i === 0 && segment.gap ? prevClose * (1 + segment.gap / 100) : prevClose

    let change = noise[i]
    if (drift) change += drift[i]
    else if (segment.revert) change -= segment.revert * (Math.log(open) - anchor)

    const close = open * Math.exp(change)
    const wick = () => Math.abs(random.normal(0, vol * 0.7))
    const high = Math.max(open, close) * Math.exp(wick() * (segment.upperWick ?? 1))
    const low = Math.min(open, close) * Math.exp(-wick() * (segment.lowerWick ?? 1))

    const activity = 1 + Math.min(2, Math.abs(change) / Math.max(vol, 1e-6)) * 0.35
    const volume = Math.round(
      baseVolume * volumeScale * activity * Math.exp(random.normal(0, 0.22)),
    )

    candles.push({
      time: (previous?.time ?? BASE_TIME - barSeconds) + barSeconds,
      open,
      high,
      low,
      close,
      volume,
    })
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function rangeOf(candle: OhlcvCandle): number {
  return (candle.high - candle.low) / candle.close
}

function buildScenario(spec: ScenarioSpec): MarketShockScenario {
  const random = createRandom(spec.seed)
  const barSeconds = getTimeframe(spec.primaryTimeframe).seconds
  const raw: OhlcvCandle[] = []
  const add = (segments: Segment[]) => {
    for (const segment of segments) appendSegment(raw, segment, random, spec.baseVolume, barSeconds)
    return raw.length
  }

  const initialVisibleIndex = add(spec.history)
  const checkpoints = spec.phases.map((segments) => add(segments)) as [number, number, number]
  add(spec.aftermath)

  // Масштабируем так, чтобы текущая цена на старте была ровной и заданной.
  const scale = spec.currentPrice / raw[initialVisibleIndex - 1].close
  const candles = raw.map((candle) => ({
    ...candle,
    open: round2(candle.open * scale),
    high: round2(candle.high * scale),
    low: round2(candle.low * scale),
    close: round2(candle.close * scale),
  }))

  const history = candles.slice(initialVisibleIndex - METRIC_WINDOW, initialVisibleIndex)
  const historyRange = mean(history.map(rangeOf))
  const historyVolume = mean(history.map((candle) => candle.volume))

  const phases = checkpoints.map((checkpoint, index) => {
    const start = index === 0 ? initialVisibleIndex : checkpoints[index - 1]
    const slice = candles.slice(start, checkpoint)
    const phase: MarketShockPhase = {
      volatilityChange: Math.round((mean(slice.map(rangeOf)) / historyRange - 1) * 100),
      liquidityChange: spec.liquidity[index],
      volumeMultiplier:
        Math.round((mean(slice.map((candle) => candle.volume)) / historyVolume) * 10) / 10,
      priceChange: (candles[checkpoint - 1].close / candles[start - 1].close - 1) * 100,
      marketDescription: spec.descriptions[index],
      availableActions: ALL_ACTIONS,
    }
    return phase
  }) as [MarketShockPhase, MarketShockPhase, MarketShockPhase]

  const recent = candles.slice(initialVisibleIndex - 12, initialVisibleIndex)
  const longer = candles.slice(initialVisibleIndex - 96, initialVisibleIndex)

  return {
    id: spec.id,
    seed: spec.seed,
    pattern: spec.pattern,
    preStructure: spec.preStructure,
    assetHiddenName: spec.assetHiddenName,
    revealAsset: spec.revealAsset,
    revealPeriod: spec.revealPeriod,
    revealEvent: spec.revealEvent,
    revealDescription: spec.revealDescription,
    synthetic: true,
    primaryTimeframe: spec.primaryTimeframe,
    contextTimeframe: spec.contextTimeframe,
    candles,
    initialVisibleIndex,
    phaseCheckpoints: checkpoints,
    initialPosition: spec.position,
    context: {
      volatility: spec.contextVolatility,
      liquidity: 'нормальная',
      volumeMultiplier:
        Math.round(
          (mean(recent.map((candle) => candle.volume)) / mean(longer.map((c) => c.volume))) * 10,
        ) / 10,
    },
    phases,
    crowd: spec.crowd,
  }
}

const SPECS: ScenarioSpec[] = [
  {
    id: 'shock_trend_collapse',
    seed: 310220,
    pattern: 'trend-collapse',
    preStructure: 'uptrend',
    assetHiddenName: 'Фондовый индекс',
    revealAsset: 'S&P 500',
    revealPeriod: 'февраль–март 2020',
    revealEvent: 'COVID sell-off',
    revealDescription:
      'Рынок торговался у исторических максимумов, когда новости о распространении вируса за пределами Китая запустили самую быструю распродажу в истории индекса. Каждый отскок в первые недели выкупался продавцами.',
    primaryTimeframe: '1h',
    contextTimeframe: '1d',
    baseVolume: 1_200_000,
    currentPrice: 101.49,
    position: { direction: 'long', exposure: 0.6, entryPrice: 97.8 },
    contextVolatility: 'обычная',
    history: [
      { bars: 240, move: 1.5, vol: 0.3 },
      { bars: 200, move: 4, vol: 0.3 },
      { bars: 120, move: -1.8, vol: 0.3 },
      { bars: 140, move: 3.5, vol: 0.24, volume: 1.05 },
      { bars: 68, move: 2.8, vol: 0.2, volume: 1.05 },
    ],
    phases: [
      [
        { bars: 6, move: 0.3, vol: 0.3, volume: 1.3 },
        { bars: 6, move: -1.7, vol: 0.36, volume: 1.8 },
      ],
      [
        { bars: 4, gap: -2.2, move: -5.5, vol: 0.77, volume: 3.8, lowerWick: 1.8, shape: 'front' },
        { bars: 8, move: -2.8, vol: 0.7, volume: 2.8, lowerWick: 1.5 },
      ],
      [
        { bars: 5, move: 1.4, vol: 0.63, volume: 2.2 },
        { bars: 7, move: -4.2, vol: 0.7, volume: 2.6 },
      ],
    ],
    aftermath: [
      { bars: 8, gap: -1, move: -4.5, vol: 0.77, volume: 2.8 },
      { bars: 8, move: 1.2, vol: 0.63, volume: 2.2 },
    ],
    liquidity: [-12, -47, -38],
    descriptions: [
      'Рост замедлился, свечи стали шире. Объём выше среднего, цена ушла под локальный минимум.',
      'Открытие с разрывом вниз и серия широких свечей. Спреды расширились, стакан заметно тоньше.',
      'После короткого отскока продажи возобновились. Волатильность остаётся высокой.',
    ],
    crowd: [
      { hold: 52, hedge: 22, close: 14, increase: 12 },
      { hold: 28, hedge: 31, close: 33, increase: 8 },
      { hold: 30, hedge: 20, close: 38, increase: 12 },
    ],
  },
  {
    id: 'shock_v_reversal',
    seed: 240805,
    pattern: 'v-reversal',
    preStructure: 'range',
    assetHiddenName: 'Фондовый индекс',
    revealAsset: 'Nasdaq 100',
    revealPeriod: 'август 2024',
    revealEvent: 'Сворачивание carry trade в иене',
    revealDescription:
      'После повышения ставки Банком Японии фонды массово закрывали позиции, профинансированные в иене. Азиатские рынки обвалились за одну сессию, американские фьючерсы пролили на открытии — и почти полностью восстановились за следующие дни.',
    primaryTimeframe: '15m',
    contextTimeframe: '4h',
    baseVolume: 420_000,
    currentPrice: 214.36,
    position: { direction: 'long', exposure: 0.6, entryPrice: 212.1 },
    contextVolatility: 'обычная',
    history: [
      { bars: 160, move: -2.5, vol: 0.15 },
      { bars: 480, revert: 0.02, vol: 0.14 },
    ],
    phases: [
      [{ bars: 12, move: -1, vol: 0.22, volume: 1.6 }],
      [
        { bars: 5, gap: -1.2, move: -4.8, vol: 0.42, volume: 4, lowerWick: 2, shape: 'front' },
        { bars: 7, move: -0.9, vol: 0.39, volume: 3, lowerWick: 2.5 },
      ],
      [{ bars: 12, move: 3.8, vol: 0.35, volume: 2.6, lowerWick: 1.3, shape: 'front' }],
    ],
    aftermath: [{ bars: 16, move: 3.2, vol: 0.35, volume: 1.8 }],
    liquidity: [-10, -52, -30],
    descriptions: [
      'Цена прижимается к нижней границе диапазона. Объём выше обычного, свечи немного шире.',
      'Резкий пролив сквозь границу диапазона, длинные нижние тени. Объём в несколько раз выше среднего.',
      'Продажи замедлились, цена отыграла часть падения. Волатильность всё ещё высокая.',
    ],
    crowd: [
      { hold: 58, hedge: 20, close: 12, increase: 10 },
      { hold: 24, hedge: 30, close: 40, increase: 6 },
      { hold: 38, hedge: 14, close: 22, increase: 26 },
    ],
  },
  {
    id: 'shock_false_breakdown',
    seed: 230310,
    pattern: 'false-breakdown',
    preStructure: 'compression',
    assetHiddenName: 'Цифровой актив',
    revealAsset: 'Bitcoin',
    revealPeriod: 'март 2023',
    revealEvent: 'Банковский кризис в США (SVB)',
    revealDescription:
      'Новости о проблемах Silvergate и SVB вытолкнули цену из узкого диапазона вниз. Через выходные регуляторы гарантировали вклады — и пробой превратился в ловушку для продавцов: цена вернулась в диапазон и ушла выше.',
    primaryTimeframe: '1h',
    contextTimeframe: '1d',
    baseVolume: 38_000,
    currentPrice: 48.62,
    position: { direction: 'short', exposure: 0.5, entryPrice: 49.35 },
    contextVolatility: 'низкая',
    history: [
      { bars: 260, move: 6, vol: 0.35 },
      { bars: 300, revert: 0.015, vol: 0.3 },
      { bars: 148, revert: 0.03, vol: 0.2, volume: 0.85 },
      { bars: 60, revert: 0.06, vol: 0.1, volume: 0.75 },
    ],
    phases: [
      [{ bars: 12, move: -0.8, vol: 0.2, volume: 1.3 }],
      [
        { bars: 4, gap: -1.4, move: -4.2, vol: 0.56, volume: 3.6, lowerWick: 1.5, shape: 'front' },
        { bars: 8, move: -0.6, vol: 0.49, volume: 2.6, lowerWick: 2.2 },
      ],
      [{ bars: 12, move: 5.4, vol: 0.56, volume: 3, shape: 'front' }],
    ],
    aftermath: [{ bars: 16, move: 4.2, vol: 0.42, volume: 2.2 }],
    liquidity: [-8, -44, -36],
    descriptions: [
      'Диапазон продолжает сужаться. Объём подрастает, цена у нижней границы.',
      'Пробой вниз из диапазона на повышенном объёме. Длинные нижние тени, спреды шире обычного.',
      'Цена быстро вернулась выше уровня пробоя. Объём остаётся высоким.',
    ],
    crowd: [
      { hold: 55, hedge: 15, close: 12, increase: 18 },
      { hold: 34, hedge: 10, close: 16, increase: 40 },
      { hold: 26, hedge: 28, close: 38, increase: 8 },
    ],
  },
  {
    id: 'shock_liquidity_crisis',
    seed: 200309,
    pattern: 'liquidity-crisis',
    preStructure: 'downtrend',
    assetHiddenName: 'Сырьевой фьючерс',
    revealAsset: 'Нефть WTI',
    revealPeriod: 'март 2020',
    revealEvent: 'Распад сделки ОПЕК+ и ценовая война',
    revealDescription:
      'Нефть уже снижалась на страхах за спрос, когда переговоры ОПЕК+ провалились и Саудовская Аравия объявила о росте добычи. Рынок открылся с огромным разрывом, после чего неделями ходил в широком рваном диапазоне.',
    primaryTimeframe: '1h',
    contextTimeframe: '1d',
    baseVolume: 260_000,
    currentPrice: 41.28,
    position: { direction: 'long', exposure: 0.6, entryPrice: 44.1 },
    contextVolatility: 'повышенная',
    history: [
      { bars: 240, move: 4, vol: 0.4 },
      { bars: 468, move: -6, vol: 0.45, volume: 1.1 },
      { bars: 60, move: -3.2, vol: 0.32, volume: 1.15 },
    ],
    phases: [
      [{ bars: 12, move: -2.2, vol: 0.49, volume: 1.9 }],
      [
        { bars: 3, gap: -4.5, move: -8.5, vol: 1.12, volume: 4.2, lowerWick: 1.5, shape: 'front' },
        { bars: 9, move: -1.5, vol: 1.05, volume: 3, upperWick: 1.6, lowerWick: 1.6 },
      ],
      [{ bars: 12, move: 0.6, vol: 0.84, volume: 2.3, upperWick: 1.8, lowerWick: 1.8 }],
    ],
    aftermath: [{ bars: 16, move: 1.5, vol: 0.63, volume: 1.7 }],
    liquidity: [-18, -61, -44],
    descriptions: [
      'Снижение ускоряется, свечи шире обычного. Ликвидность постепенно уходит.',
      'Открытие с большим разрывом вниз. Стакан тонкий, диапазон движения резко вырос.',
      'Цена ходит в широком диапазоне с длинными тенями в обе стороны.',
    ],
    crowd: [
      { hold: 40, hedge: 24, close: 26, increase: 10 },
      { hold: 22, hedge: 26, close: 44, increase: 8 },
      { hold: 42, hedge: 18, close: 24, increase: 16 },
    ],
  },
  {
    id: 'shock_second_leg',
    seed: 230313,
    pattern: 'second-leg',
    preStructure: 'recovery',
    assetHiddenName: 'Отраслевой индекс',
    revealAsset: 'Банковский сектор США (KBW Bank Index)',
    revealPeriod: 'март 2023',
    revealEvent: 'Крах Silicon Valley Bank',
    revealDescription:
      'Банки только отыгрывали падение прошлого года, когда SVB объявил о продаже портфеля облигаций с убытком. Первый пролив сменился короткой стабилизацией, но после выходных рынок начал искать следующее слабое звено — и пошла вторая волна продаж.',
    primaryTimeframe: '15m',
    contextTimeframe: '4h',
    baseVolume: 310_000,
    currentPrice: 88.4,
    position: { direction: 'long', exposure: 0.6, entryPrice: 85.3 },
    contextVolatility: 'обычная',
    history: [
      { bars: 200, move: -9, vol: 0.3, volume: 1.3 },
      { bars: 120, revert: 0.02, vol: 0.22 },
      { bars: 320, move: 7, vol: 0.18 },
    ],
    phases: [
      [{ bars: 12, move: -0.9, vol: 0.25, volume: 1.5 }],
      [
        { bars: 4, gap: -1, move: -4, vol: 0.42, volume: 3.6, lowerWick: 1.5, shape: 'front' },
        { bars: 8, move: -1.4, vol: 0.35, volume: 2.6 },
      ],
      [{ bars: 12, move: 2.4, vol: 0.4, volume: 1.6 }],
    ],
    aftermath: [
      { bars: 4, gap: -0.8, move: -3.5, vol: 0.42, volume: 3.4, shape: 'front' },
      { bars: 12, move: -3.2, vol: 0.39, volume: 2.8 },
    ],
    liquidity: [-10, -45, -25],
    descriptions: [
      'Восстановление остановилось, цена топчется под недавним максимумом. Объём растёт.',
      'Резкое падение на объёме в несколько раз выше среднего. Спреды расширились.',
      'Цена стабилизировалась и отскочила от минимума. Объём снижается, но выше обычного.',
    ],
    crowd: [
      { hold: 55, hedge: 18, close: 15, increase: 12 },
      { hold: 30, hedge: 28, close: 34, increase: 8 },
      { hold: 40, hedge: 12, close: 16, increase: 32 },
    ],
  },
]

export const marketShockScenarios: MarketShockScenario[] = SPECS.map(buildScenario)

export function getMarketShockScenario(id?: string | null): MarketShockScenario {
  return marketShockScenarios.find((scenario) => scenario.id === id) ?? marketShockScenarios[0]
}

export function pickMarketShockScenario(attempt: number): MarketShockScenario {
  return marketShockScenarios[attempt % marketShockScenarios.length]
}
