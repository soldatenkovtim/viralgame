import { metadata } from '@/scenario-engine/scenarioTypes'
import type { FairValueRegime, FlowRegime, MarketMakerScenario } from '@/types/game'

export const MM_TICK_MS = 500
export const MM_MIN_SPREAD = 0.2
export const MM_MAX_SPREAD = 2.0
export const MM_INITIAL_SPREAD = 0.8
export const MM_QUOTE_STEP = 0.1
/** Maximum quote midpoint displacement from the external market, 2%. */
export const MM_MAX_QUOTE_OFFSET_RATIO = 0.02
/** Fee per asset unit executed against a maker quote. */
export const MM_TRANSACTION_COST_PER_UNIT = 0.005
/** Одна единица inventory — лот из 100 акций. */
export const MM_LOT_SIZE = 100
/** Проскальзывание хеджа на единицу, в цене: порядка половины рыночного спреда. */
export const MM_HEDGE_COST_PER_UNIT = 0.25
/** Фиксированная комиссия за каждый хедж, в деньгах. */
export const MM_HEDGE_TICKET_FEE = 75
export const MM_SOFT_INVENTORY_LIMIT = 15
export const MM_HARD_INVENTORY_LIMIT = 25
/** Через сколько тиков считается markout сделки (прокси adverse selection). */
export const MM_MARKOUT_TICKS = 10

export const marketMakerScenarios: MarketMakerScenario[] = [
  {
    ...metadata('market-maker', 'noise-dominant', 60), id: 'mm-noise-01', seed: 270431,
    title: 'Спокойный поток', initialFairValue: 100, durationSeconds: 60,
    flowPhases: [{ regime: 'noise', from: 0, to: 60, intensity: 1.2 }],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 20, strength: 0.8 },
      { regime: 'drift-up', from: 20, to: 40, strength: 0.55 },
      { regime: 'calm', from: 40, to: 60, strength: 0.8 },
    ],
  },
  {
    ...metadata('market-maker', 'toxic-transition', 60), id: 'mm-toxic-01', seed: 401173,
    title: 'Токсичный поток', initialFairValue: 100, durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 22, intensity: 1.1 },
      { regime: 'informed', from: 22, to: 44, intensity: 0.5 },
      { regime: 'noise', from: 44, to: 60, intensity: 1.1 },
    ],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 22, strength: 0.8 },
      { regime: 'drift-up', from: 22, to: 44, strength: 0.85 },
      { regime: 'calm', from: 44, to: 60, strength: 0.8 },
    ],
  },
  {
    ...metadata('market-maker', 'inventory-pressure', 60), id: 'mm-inventory-01', seed: 918264,
    title: 'Давление на inventory', initialFairValue: 100, durationSeconds: 60,
    flowPhases: [
      { regime: 'noise', from: 0, to: 18, intensity: 1.1 },
      { regime: 'momentum', from: 18, to: 44, intensity: 1.1 },
      { regime: 'noise', from: 44, to: 60, intensity: 1.1 },
    ],
    fairValuePhases: [
      { regime: 'calm', from: 0, to: 18, strength: 0.8 },
      { regime: 'drift-down', from: 18, to: 44, strength: 0.85 },
      { regime: 'volatile', from: 44, to: 60, strength: 0.8 },
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
