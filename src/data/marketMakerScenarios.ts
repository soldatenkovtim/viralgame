import type { BotType, MarketMakerScenario } from '@/types/game'

export const MM_TICK_MS = 800
export const MM_MIN_SPREAD = 0.2
export const MM_MAX_SPREAD = 2.0
export const MM_INITIAL_SPREAD = 0.8
export const MM_QUOTE_STEP = 0.1
export const MM_HEDGE_COST_PER_UNIT = 0.05
/** Через сколько тиков считается markout сделки (прокси adverse selection). */
export const MM_MARKOUT_TICKS = 5

export const marketMakerScenarios: MarketMakerScenario[] = [
  {
    id: 'mm_noise',
    seed: 401173,
    botType: 'noise',
    volatility: 0.055,
    initialFairValue: 100,
    durationSeconds: 60,
  },
  {
    id: 'mm_informed',
    seed: 918264,
    botType: 'informed',
    volatility: 0.085,
    initialFairValue: 100,
    durationSeconds: 60,
  },
  {
    id: 'mm_momentum',
    seed: 553902,
    botType: 'momentum',
    volatility: 0.072,
    initialFairValue: 100,
    durationSeconds: 60,
  },
]

export const botTypeLabels: Record<BotType, string> = {
  noise: 'шумовой трейдер',
  informed: 'информированный поток',
  momentum: 'моментум-трейдер',
}

export const botTypeReveal: Record<BotType, string> = {
  noise: 'Против тебя торговал шумовой трейдер.',
  informed: 'Против тебя торговал информированный поток.',
  momentum: 'Против тебя торговал моментум-трейдер.',
}

export const botTypeExplanation: Record<BotType, string> = {
  noise:
    'Его сделки почти не связаны с будущей ценой. Основной заработок здесь — спред, а основной риск — накопленный инвентарь.',
  informed:
    'Он видел, куда пойдёт справедливая цена, и забирал у тебя ту сторону котировки, которая была выгодна ему.',
  momentum:
    'Он входил в сторону уже случившегося движения. Инвентарь накапливался против тренда и требовал внимания.',
}

export function getMarketMakerScenario(id?: string | null): MarketMakerScenario {
  if (id) {
    const found = marketMakerScenarios.find((scenario) => scenario.id === id)
    if (found) return found
  }
  return marketMakerScenarios[0]
}

/** Тип контрагента выбирается случайно — игрок не должен знать его заранее. */
export function pickRandomMarketMakerScenario(): MarketMakerScenario {
  const index = Math.floor(Math.random() * marketMakerScenarios.length)
  return marketMakerScenarios[index]
}
