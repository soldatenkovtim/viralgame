import type { BlackSwanScenario } from '@/types/game'

export const BLACK_SWAN_DECISION_SECONDS = 20
export const BLACK_SWAN_HEDGE_RESIDUAL = 0.35
export const BLACK_SWAN_HEDGE_COST_PERCENT = 0.4

export const blackSwanScenarios: BlackSwanScenario[] = [
  {
    id: 'swan_energy',
    titleAfterReveal: 'Это был энергетический шок',
    revealDescription:
      'Сценарий вдохновлён обвалом на рынке энергоносителей, когда спрос исчез быстрее, чем участники успели перестроить позиции. Ликвидность ушла раньше цены, и закрыться по «справедливому» уровню было уже невозможно.',
    seed: 220401,
    initialPosition: 0.6,
    initialPnl: 3.7,
    contextVolatility: 'нормальная',
    phases: [
      {
        priceChange: -1.8,
        volatilityChange: 35,
        liquidityChange: -12,
        description: 'Рынок сдаёт часть движения. Спреды чуть шире обычного, объём растёт.',
      },
      {
        priceChange: -9.4,
        volatilityChange: 240,
        liquidityChange: -68,
        description:
          'Резкий пролив. Стакан тонкий, заявки исполняются заметно хуже ожидаемого.',
      },
      {
        priceChange: -4.1,
        volatilityChange: 120,
        liquidityChange: -40,
        description:
          'После первой волны рынок пытается отскочить, но продавливается ещё раз.',
      },
    ],
  },
  {
    id: 'swan_liquidity',
    titleAfterReveal: 'Это был кризис ликвидности',
    revealDescription:
      'Стилизованный сценарий системного стресса: сначала рынок выглядит просто нервным, затем контрагенты одновременно сокращают риск, и обычные корреляции перестают работать. Отскок приходит внезапно и так же быстро.',
    seed: 200809,
    initialPosition: 0.6,
    initialPnl: 2.4,
    contextVolatility: 'слегка повышенная',
    phases: [
      {
        priceChange: -2.6,
        volatilityChange: 60,
        liquidityChange: -25,
        description:
          'Коррелированные активы начинают двигаться вместе. Это редко бывает хорошим знаком.',
      },
      {
        priceChange: -11.2,
        volatilityChange: 310,
        liquidityChange: -74,
        description:
          'Массовое сокращение риска. Продают всё подряд, включая качественные позиции.',
      },
      {
        priceChange: 6.8,
        volatilityChange: 180,
        liquidityChange: -35,
        description:
          'Появляется крупный покупатель. Рынок разворачивается так же резко, как падал.',
      },
    ],
  },
  {
    id: 'swan_currency',
    titleAfterReveal: 'Это был резкий валютный шок',
    revealDescription:
      'Сценарий по мотивам ситуаций, когда регулятор неожиданно меняет режим курса. Первое движение почти невозможно отторговать, а основной риск приходится на решение сразу после него.',
    seed: 150115,
    initialPosition: 0.6,
    initialPnl: 5.1,
    contextVolatility: 'низкая',
    phases: [
      {
        priceChange: 1.2,
        volatilityChange: 15,
        liquidityChange: -5,
        description: 'Рынок спокоен. Позиция продолжает медленно работать в плюс.',
      },
      {
        priceChange: -14.6,
        volatilityChange: 420,
        liquidityChange: -82,
        description:
          'Неожиданное решение регулятора. Цена перепрыгивает целые уровни без сделок.',
      },
      {
        priceChange: -2.2,
        volatilityChange: 200,
        liquidityChange: -55,
        description:
          'Рынок стабилизируется на новом уровне, но волатильность остаётся высокой.',
      },
    ],
  },
]

export function getBlackSwanScenario(id?: string | null): BlackSwanScenario {
  if (id) {
    const found = blackSwanScenarios.find((scenario) => scenario.id === id)
    if (found) return found
  }
  return blackSwanScenarios[0]
}

export function pickBlackSwanScenario(attempt: number): BlackSwanScenario {
  return blackSwanScenarios[attempt % blackSwanScenarios.length]
}
