import { scaleTrait, traitOrder, type ProfileInput, type TraitKey } from './profile'
import { observationEvidence, observationFinding } from './profileEvidence'
export { observationEvidence } from './profileEvidence'
import type { TradingProfile } from '@/types/game'

export const traitExplanations: Record<TraitKey, { meaning: string; sources: string; interpretation: string }> = {
  marketSense: {
    interpretation: 'Выше — больше совпадений позиции с реализованным движением. Удачное направление в отдельном решении само по себе не подтверждает качество анализа или навык прогнозирования.',
    meaning: 'Насколько направление и размер позиции совпали с последующим движением цены.',
    sources: '«Слепой рынок»: экспозиция в каждом решении и доходность следующих отрезков.',
  },
  riskControl: {
    interpretation: 'Выше — меньше просадка и экспозиция в шоке, лучше соблюдены ограничения позиции в маркет-мейкинге. Отдельное сокращение позиции не определяет всю оценку.',
    meaning: 'Как игровая модель оценивает ограничение позиционного риска.',
    sources: '«Маркет-мейкер»: максимальная и конечная позиция, время выше лимита, уместность хеджа. «Рыночный шок»: максимальная просадка и экспозиция.',
  },
  pricing: {
    interpretation: 'Выше — лучше результат котирования с учётом потерь и издержек. Прибыль от роста стоимости открытой позиции сама по себе не повышает этот показатель.',
    meaning: 'Результативность котирования с учётом издержек и риска.',
    sources: '«Маркет-мейкер»: результат без положительной переоценки позиции, штраф за время выше лимита, сохранённый заработок на спреде и потери от информированного потока.',
  },
  adaptability: {
    interpretation: 'Выше — больше результативных изменений и своевременных действий по правилам модели. Часть оценки использует последующее движение; активность сама по себе не доказывает качество решения.',
    meaning: 'Результативность и своевременность реакции на меняющийся рынок.',
    sources: 'Все четыре испытания: эффект изменений позиции в «Слепом рынке»; спред, отставание и изменения котировок у маркет-мейкера; реакция и изменения позиции в шоке; скорость, тайм-ауты и прибыльные сделки до схождения котировок в арбитраже.',
  },
  discipline: {
    interpretation: 'Выше — лучше сочетание модельных факторов. Время решения и точность уверенности — условные игровые признаки; убыток сам по себе не доказывает недисциплинированность.',
    meaning: 'Игровая оценка соблюдения условий игры и последовательности решений.',
    sources: '«Слепой рынок»: просадка и соответствие уверенности точности направления. «Рыночный шок»: время решения, тайм-ауты и сокращения сразу после наращивания. «Кросс-арбитраж»: отказы в раундах без исходной возможности и сделки без положительной расчётной доходности после комиссий и исполнения объёма. Здесь результат вычисляется по котировкам в момент решения, а не по последующему движению рынка.',
  },
  opportunity: {
    interpretation: 'Выше — больше найденных возможностей и доля полученной доходности. Сравнение с исходными котировками включает эффект упущенного времени; пояснение решения использует котировки на момент выбора.',
    meaning: 'Какую часть доступных возможностей удалось реализовать.',
    sources: '«Кросс-арбитраж»: доля найденных прибыльных возможностей и полученная доходность относительно доступной после издержек.',
  },
}

export function rankedTraits(profile: TradingProfile): TraitKey[] {
  return [...traitOrder].sort((a, b) => profile[b] - profile[a])
}

/** Pair archetypes are defined by their two highest traits. Behavioural exceptions
 * have no additional defining trait, so retain the actual three highest scores. */
export function shareCardTraits(profile: TradingProfile): TraitKey[] {
  return rankedTraits(profile).slice(0, 3)
}

export function traitEvidence(trait: TraitKey, input: ProfileInput): string | null {
  // In explanations show an actual decision, including an adverse one if present.
  return observationEvidence(trait, input, false) ?? observationEvidence(trait, input, true)
}

export function profileObservations(profile: TradingProfile, input: ProfileInput) {
  const ranked = rankedTraits(profile)
  const observation = (trait: TraitKey, strength: boolean) => {
    const evidence = strength && profile[trait] <= scaleTrait(50) ? null : observationFinding(trait, input, strength)
    return {
      trait,
      value: profile[trait],
      summary: evidence?.summary ?? traitExplanations[trait].meaning,
      text: evidence?.detail ?? `Расчётная характеристика — ${profile[trait]}/100. ${traitExplanations[trait].sources} ${traitExplanations[trait].interpretation}`,
    }
  }
  const distinct = profile[ranked[0]] !== profile[ranked[ranked.length - 1]]
  return {
    strengths: distinct ? ranked.slice(0, 2).filter(t => profile[t] > profile[ranked[5]]).map(t => observation(t, true)) : [],
    growth: distinct ? ranked.slice(-2).reverse().filter(t => profile[t] < profile[ranked[0]]).map(t => observation(t, false)) : [],
  }
}
