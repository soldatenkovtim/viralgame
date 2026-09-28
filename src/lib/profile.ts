import { blindTraits } from '@/games/blind-market/scoring'
import { getMarketShockScenario } from '@/games/market-shock/scenarios'
import { marketShockTraits } from '@/games/market-shock/scoring'
import {
  crossArbitrageSentence,
  crossArbitrageTraits,
} from '@/games/cross-arbitrage/scoring'
import { marketMakerTraits } from '@/games/market-maker/scoring'
import { LEADERBOARD_MAX_SCORE, TOTAL_CHALLENGES, TRAIT_MAX, TRAIT_MIN } from '@/lib/constants'
import { clamp } from '@/lib/random'
import type {
  BlindMarketResult,
  CrossArbitrageResult,
  MarketMakerResult,
  MarketShockResult,
  TradingProfile,
} from '@/types/game'

export type TraitKey =
  | 'marketSense'
  | 'riskControl'
  | 'pricing'
  | 'adaptability'
  | 'discipline'
  | 'opportunity'

export const traitLabels: Record<TraitKey, string> = {
  marketSense: 'Рыночное чутьё',
  riskControl: 'Контроль риска',
  pricing: 'Ценообразование',
  adaptability: 'Адаптивность',
  discipline: 'Дисциплина',
  opportunity: 'Поиск возможностей',
}

export const traitOrder: TraitKey[] = [
  'marketSense',
  'riskControl',
  'pricing',
  'adaptability',
  'discipline',
  'opportunity',
]

export interface ProfileInput {
  blindMarket?: BlindMarketResult
  marketMaker?: MarketMakerResult
  blackSwan?: MarketShockResult
  crossArbitrage?: CrossArbitrageResult
}

/**
 * Вклад испытаний в характеристики.
 * Каждое испытание влияет только на свою часть профиля.
 */
const CONTRIBUTION_WEIGHTS = {
  blindMarket: { marketSense: 0.45, adaptability: 0.3, discipline: 0.25 },
  marketMaker: { pricing: 0.45, riskControl: 0.35, adaptability: 0.2 },
  blackSwan: { riskControl: 0.4, adaptability: 0.35, discipline: 0.25 },
  crossArbitrage: { opportunity: 0.5, discipline: 0.3, adaptability: 0.2 },
} as const

export function buildTradingProfile(input: ProfileInput): TradingProfile {
  const weighted: Record<TraitKey, { sum: number; weight: number }> = {
    marketSense: { sum: 0, weight: 0 },
    riskControl: { sum: 0, weight: 0 },
    pricing: { sum: 0, weight: 0 },
    adaptability: { sum: 0, weight: 0 },
    discipline: { sum: 0, weight: 0 },
    opportunity: { sum: 0, weight: 0 },
  }

  const add = (trait: TraitKey, value: number, weight: number) => {
    weighted[trait].sum += value * weight
    weighted[trait].weight += weight
  }

  if (input.blindMarket) {
    const traits = blindTraits(input.blindMarket)
    const w = CONTRIBUTION_WEIGHTS.blindMarket
    add('marketSense', traits.marketSense, w.marketSense)
    add('adaptability', traits.adaptability, w.adaptability)
    add('discipline', traits.discipline, w.discipline)
  }

  if (input.marketMaker) {
    const traits = marketMakerTraits(input.marketMaker)
    const w = CONTRIBUTION_WEIGHTS.marketMaker
    add('pricing', traits.pricing, w.pricing)
    add('riskControl', traits.riskControl, w.riskControl)
    add('adaptability', traits.adaptability, w.adaptability)
  }

  if (input.blackSwan) {
    const scenario = getMarketShockScenario(input.blackSwan.scenarioId)
    const traits = marketShockTraits(input.blackSwan, scenario)
    const w = CONTRIBUTION_WEIGHTS.blackSwan
    add('riskControl', traits.riskControl, w.riskControl)
    add('adaptability', traits.adaptability, w.adaptability)
    add('discipline', traits.discipline, w.discipline)
  }

  if (input.crossArbitrage) {
    const traits = crossArbitrageTraits(input.crossArbitrage)
    const w = CONTRIBUTION_WEIGHTS.crossArbitrage
    add('opportunity', traits.opportunity, w.opportunity)
    add('discipline', traits.discipline, w.discipline)
    add('adaptability', traits.adaptability, w.adaptability)
  }

  const values = {} as Record<TraitKey, number>
  for (const trait of traitOrder) {
    const entry = weighted[trait]
    const raw = entry.weight > 0 ? entry.sum / entry.weight : 50
    values[trait] = scaleTrait(raw)
  }

  const archetype = resolveArchetype(values, input)

  return {
    ...values,
    archetype: archetype.name,
    description: buildDescription(input),
  }
}

/** Показатели приводятся к 20–95: крайние 0 и 100 не показываем никогда. */
export function scaleTrait(raw: number): number {
  const normalized = clamp(raw, 0, 100) / 100
  return Math.round(TRAIT_MIN + normalized * (TRAIT_MAX - TRAIT_MIN))
}

/* ------------------------------------------------------------------ */
/* Архетипы                                                            */
/* ------------------------------------------------------------------ */

export interface Archetype {
  name: string
  tagline: string
}

const PAIR_ARCHETYPES: Record<string, Archetype> = {
  'adaptability+marketSense': {
    name: 'Адаптивный трейдер',
    tagline: 'Меняешь взгляд вместе с рынком, а не вопреки ему.',
  },
  'discipline+riskControl': {
    name: 'Дисциплинированный риск-менеджер',
    tagline: 'Сначала размер риска, потом идея.',
  },
  'pricing+riskControl': {
    name: 'Поставщик ликвидности',
    tagline: 'Зарабатываешь на цене, а не на направлении.',
  },
  'discipline+marketSense': {
    name: 'Селективный трейдер',
    tagline: 'Ждёшь свою ситуацию и не торгуешь всё подряд.',
  },
  'adaptability+discipline': {
    name: 'Тактический трейдер',
    tagline: 'Часто перестраиваешь позицию, оставаясь в рамках плана.',
  },
  'adaptability+pricing': {
    name: 'Гибкий маркет-мейкер',
    tagline: 'Подстраиваешь котировку под характер потока.',
  },
  'discipline+pricing': {
    name: 'Методичный котировщик',
    tagline: 'Держишь одну модель цены и не отходишь от неё.',
  },
  'marketSense+pricing': {
    name: 'Читатель потока',
    tagline: 'Считываешь, кто стоит по другую сторону сделки.',
  },
  'marketSense+riskControl': {
    name: 'Осторожный охотник',
    tagline: 'Берёшь направление, но никогда не всем размером.',
  },
  'adaptability+riskControl': {
    name: 'Кризисный управляющий',
    tagline: 'Лучше всего работаешь, когда рынок ломается.',
  },
  'marketSense+opportunity': {
    name: 'Охотник за расхождениями',
    tagline: 'Замечаешь, где рынок ошибается, раньше остальных.',
  },
  'discipline+opportunity': {
    name: 'Арбитражёр',
    tagline: 'Берёшь только тот edge, который остаётся после издержек.',
  },
  'adaptability+opportunity': {
    name: 'Быстрый арбитражёр',
    tagline: 'Успеваешь собрать сделку, пока окно ещё открыто.',
  },
  'opportunity+pricing': {
    name: 'Точный исполнитель',
    tagline: 'Видишь цену сделки вместе со всеми издержками.',
  },
  'opportunity+riskControl': {
    name: 'Осторожный арбитражёр',
    tagline: 'Берёшь расхождение, только когда риск уже посчитан.',
  },
}

export const OPPORTUNIST: Archetype = {
  name: 'Оппортунист',
  tagline: 'Видишь движение и не боишься взять его размером.',
}

export const CONTRARIAN: Archetype = {
  name: 'Контртрендовый игрок',
  tagline: 'Идёшь против движения — и в этой сессии это сработало.',
}

export function resolveArchetype(
  values: Record<TraitKey, number>,
  input: ProfileInput,
): Archetype {
  const sorted = [...traitOrder].sort((a, b) => values[b] - values[a])
  const [first, second] = sorted

  // Особые случаи важнее пары характеристик: они описывают конкретное поведение.
  const blind = input.blindMarket
  if (blind && blind.directionChanges >= 2 && blind.pnlPercent > 0) {
    return CONTRARIAN
  }

  const swan = input.blackSwan
  if (
    (first === 'marketSense' || second === 'marketSense') &&
    swan &&
    swan.maxExposure >= 0.8
  ) {
    return OPPORTUNIST
  }

  const key = [first, second].sort().join('+')
  return (
    PAIR_ARCHETYPES[key] ?? {
      name: 'Системный трейдер',
      tagline: 'Ровный профиль без выраженных перекосов.',
    }
  )
}

export function archetypeTagline(name: string): string {
  const all = [...Object.values(PAIR_ARCHETYPES), OPPORTUNIST, CONTRARIAN]
  return all.find((archetype) => archetype.name === name)?.tagline ?? ''
}

export const allArchetypeNames: string[] = [
  ...Object.values(PAIR_ARCHETYPES).map((archetype) => archetype.name),
  OPPORTUNIST.name,
  CONTRARIAN.name,
]

/* ------------------------------------------------------------------ */
/* Текст профиля                                                       */
/* ------------------------------------------------------------------ */

/**
 * Текст собирается шаблонами из реальных решений сессии.
 * Никаких оценок человека — только описание того, что происходило в игре.
 */
export function buildDescription(input: ProfileInput): string {
  const sentences: string[] = []
  const { blindMarket, marketMaker, blackSwan, crossArbitrage } = input

  if (blindMarket) {
    const changes = blindMarket.directionChanges
    const confidence = Math.round(blindMarket.averageConfidence)
    if (changes >= 2) {
      sentences.push(
        `В слепом рынке ты несколько раз полностью менял сторону сделки по мере того, как появлялась новая информация, и держал среднюю уверенность около ${confidence}%.`,
      )
    } else if (changes === 1) {
      sentences.push(
        `В слепом рынке ты один раз развернул позицию после того, как движение пошло против входа, сохраняя среднюю уверенность около ${confidence}%.`,
      )
    } else if (blindMarket.decisions.every((decision) => decision.action !== 'reduce')) {
      sentences.push(
        `В слепом рынке ты выбрал направление и не отходил от него до конца сценария при средней уверенности около ${confidence}%.`,
      )
    } else {
      sentences.push(
        `В слепом рынке ты сохранял выбранное направление, но управлял размером позиции по ходу движения при средней уверенности около ${confidence}%.`,
      )
    }
  }

  if (blackSwan) {
    const heldThroughShock = blackSwan.decisions.some(
      (decision) => decision.phase === 2 && decision.action === 'hold',
    )
    const cutEarly = blackSwan.decisions.some(
      (decision) =>
        decision.phase === 1 &&
        (decision.action === 'close' || decision.action === 'hedge'),
    )
    if (cutEarly) {
      sentences.push(
        'В рыночном шоке ты снизил риск ещё на раннем сигнале — до основной части движения.',
      )
    } else if (heldThroughShock) {
      sentences.push(
        'В рыночном шоке ты сохранял экспозицию и после резкого движения цены.',
      )
    } else {
      sentences.push(
        'В рыночном шоке ты перестраивал позицию уже по ходу движения, а не заранее.',
      )
    }
  }

  if (marketMaker) {
    const widened = marketMaker.spreadDirectional - marketMaker.spreadNoise > 0.12
    if (marketMaker.hedgeCount > 0 && !widened) {
      sentences.push(
        'В маркет-мейкинге ты предпочитал контролировать инвентарь раньше, чем расширять спред.',
      )
    } else if (widened) {
      sentences.push(
        'В маркет-мейкинге ты защищался ценой: спред расширялся быстрее, чем сокращалась позиция.',
      )
    } else {
      sentences.push(
        'В маркет-мейкинге ты держал стабильную котировку и собирал поток, не меняя параметры резко.',
      )
    }
  }

  if (crossArbitrage) {
    sentences.push(crossArbitrageSentence(crossArbitrage))
  }

  if (!sentences.length) {
    return 'Профиль соберётся после прохождения испытаний.'
  }

  return sentences.join(' ')
}

/* ------------------------------------------------------------------ */
/* Игровой score                                                       */
/* ------------------------------------------------------------------ */

/**
 * Score для рейтинга — чисто игровая величина, 0–10 000.
 * Он намеренно не совпадает с Trading Profile.
 */
export const OVERALL_SCORE_WEIGHTS = {
  blindMarket: 0.25,
  marketMaker: 0.25,
  blackSwan: 0.25,
  crossArbitrage: 0.25,
} as const

/** Взвешенная сумма score испытаний (каждый 0–100) → 0–100. */
export function weightedChallengeScore(scores: {
  blindMarket: number
  marketMaker: number
  blackSwan: number
  crossArbitrage: number
}): number {
  const w = OVERALL_SCORE_WEIGHTS
  return (
    scores.blindMarket * w.blindMarket +
    scores.marketMaker * w.marketMaker +
    scores.blackSwan * w.blackSwan +
    scores.crossArbitrage * w.crossArbitrage
  )
}

export function computeOverallScore(input: ProfileInput): number {
  const normalized = weightedChallengeScore({
    blindMarket: input.blindMarket?.score ?? 0,
    marketMaker: input.marketMaker?.score ?? 0,
    blackSwan: input.blackSwan?.score ?? 0,
    crossArbitrage: input.crossArbitrage?.score ?? 0,
  })
  return Math.round(clamp(normalized, 0, 100) * (LEADERBOARD_MAX_SCORE / 100))
}

/** Доля собранного профиля: 0 / 25 / 50 / 75 / 100. */
export function profileCompletion(completedCount: number): number {
  const count = clamp(completedCount, 0, TOTAL_CHALLENGES)
  return Math.round((count / TOTAL_CHALLENGES) * 100)
}
