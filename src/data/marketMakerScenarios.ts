import type { FairValueRegime, FlowRegime, MarketMakerScenario } from '@/types/game'

export const MM_TICK_MS = 500
export const MM_MIN_SPREAD = 0.2
export const MM_MAX_SPREAD = 2.0
export const MM_INITIAL_SPREAD = 0.8
export const MM_QUOTE_STEP = 0.1
/** Одна единица inventory — лот из 100 акций. */
export const MM_LOT_SIZE = 100
/** Проскальзывание хеджа на единицу, в цене: порядка половины рыночного спреда. */
export const MM_HEDGE_COST_PER_UNIT = 0.25
/** Фиксированная комиссия за каждый хедж, в деньгах. */
export const MM_HEDGE_TICKET_FEE = 75
export const MM_SOFT_INVENTORY_LIMIT = 15
export const MM_HARD_INVENTORY_LIMIT = 25
/** Дисконт на ликвидность для единиц сверх жёсткого лимита, в цене. */
export const MM_HARD_LIMIT_HAIRCUT = 0.3
/** Через сколько тиков считается markout сделки (прокси adverse selection). */
export const MM_MARKOUT_TICKS = 10

/** Сценарий первого прохождения: плавная кривая сложности. */
export const MM_FIRST_ROUND_ID = 'mm_first_round'

export const marketMakerScenarios: MarketMakerScenario[] = [
  {
    id: MM_FIRST_ROUND_ID,
    seed: 270431,
    title: 'Первый раунд: мягкий шум → моментум → информированный',
    initialFairValue: 100,
    durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 15, intensity: 1.2 },
      { regime: 'momentum', from: 15, to: 35, intensity: 1.1 },
      { regime: 'informed', from: 35, to: 60, intensity: 0.5 },
    ],
    fairValuePhases: [
      { regime: 'drift-up', from: 0, to: 15, strength: 0.6 },
      { regime: 'drift-up', from: 15, to: 35, strength: 0.8 },
      { regime: 'drift-up', from: 35, to: 60, strength: 0.5 },
    ],
  },
  {
    id: 'mm_informed_rally',
    seed: 401173,
    title: 'Шум → информированный → моментум',
    initialFairValue: 100,
    durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 22 },
      { regime: 'informed', from: 22, to: 42 },
      { regime: 'momentum', from: 42, to: 60 },
    ],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 24 },
      { regime: 'drift-up', from: 24, to: 44 },
      { regime: 'volatile', from: 44, to: 60 },
    ],
  },
  {
    id: 'mm_late_informed',
    seed: 918264,
    title: 'Шум → моментум → информированный',
    initialFairValue: 100,
    durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 24 },
      { regime: 'momentum', from: 24, to: 40 },
      { regime: 'informed', from: 40, to: 60 },
    ],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 22 },
      { regime: 'drift-down', from: 22, to: 38 },
      { regime: 'calm', from: 38, to: 42 },
      { regime: 'drift-down', from: 42, to: 60 },
    ],
  },
  {
    id: 'mm_informed_break',
    seed: 553902,
    title: 'Шум → информированный → шум',
    initialFairValue: 100,
    durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 14, intensity: 0.8 },
      { regime: 'informed', from: 14, to: 34 },
      { regime: 'noise', from: 34, to: 60 },
    ],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 14, strength: 0.7 },
      { regime: 'drift-down', from: 14, to: 34 },
      { regime: 'volatile', from: 34, to: 60 },
    ],
  },
]

export const flowRegimeLabels: Record<FlowRegime, string> = {
  noise: 'Шумовой поток',
  informed: 'Информированный поток',
  momentum: 'Моментум-поток',
}

export const flowRegimeExplanation: Record<FlowRegime, string> = {
  noise: 'Случайные покупки и продажи небольшого размера. Здесь спред зарабатывается относительно безопасно.',
  informed:
    'Контрагент знал, куда пойдёт справедливая цена, и забирал ту сторону котировки, которая скоро окажется выгодной ему.',
  momentum: 'Контрагент входил в сторону уже случившегося движения рыночной цены.',
}

export const fairValueRegimeLabels: Record<FairValueRegime, string> = {
  calm: 'спокойно',
  'drift-up': 'дрейф вверх',
  'drift-down': 'дрейф вниз',
  volatile: 'высокая волатильность',
}

export function getMarketMakerScenario(id?: string | null): MarketMakerScenario {
  if (id) {
    const found = marketMakerScenarios.find((scenario) => scenario.id === id)
    if (found) return found
  }
  return marketMakerScenarios[0]
}

/**
 * Первое прохождение всегда идёт по мягкой кривой сложности. Дальше сценарий
 * выбирается случайно — игрок не должен знать заранее, как сменятся режимы.
 */
export function pickMarketMakerScenario(attempt: number): MarketMakerScenario {
  if (attempt === 0) return getMarketMakerScenario(MM_FIRST_ROUND_ID)
  const pool = marketMakerScenarios.filter((scenario) => scenario.id !== MM_FIRST_ROUND_ID)
  return pool[Math.floor(Math.random() * pool.length)]
}
