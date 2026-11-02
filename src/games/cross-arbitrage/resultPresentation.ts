import { gameEntry } from '@/lib/gameEntry'
import { CHALLENGE_ORDER, type GameState } from '@/store/gameStore'
import type { ArbitrageRoundResult, CrossArbitrageResult } from '@/types/game'
import { plural } from '@/lib/formatting'
import { formatEdge } from './scoring'

export function roundStatus(round: ArbitrageRoundResult) {
  return round.timedOut ? 'Время вышло — сделки нет' : round.choseNoTrade ? 'Сделка пропущена' : 'Сделка исполнена'
}

export function resultCounts(result: CrossArbitrageResult) {
  const trades = result.rounds.filter(round => !round.choseNoTrade)
  return {
    profitable: trades.filter(round => round.capitalReturn > 0).length,
    losing: trades.filter(round => round.capitalReturn < 0).length,
    flat: trades.filter(round => round.capitalReturn === 0).length,
    skipped: result.rounds.filter(round => round.choseNoTrade).length,
    timedOut: result.rounds.filter(round => round.timedOut).length,
  }
}

/** Presentation only: keep the engine's full-precision aggregation and classifications. */
export function sessionObservation(result: CrossArbitrageResult) {
  if (!result.rounds.length || !Number.isFinite(result.totalReturnPercent)) return 'Недостаточно данных для разбора прохождения.'
  const counts = resultCounts(result)
  const executed = result.rounds.filter(round => !round.choseNoTrade)
  if (executed.some(round => !Number.isFinite(round.capitalReturn))) {
    return `Итог прохождения — ${formatEdge(result.totalReturnPercent)}. Данных для объяснения вкладов раундов недостаточно.`
  }
  const worst = executed.reduce<ArbitrageRoundResult | undefined>((best, round) =>
    round.capitalReturn < (best?.capitalReturn ?? 0) ? round : best, undefined)
  const best = executed.reduce<ArbitrageRoundResult | undefined>((best, round) =>
    round.capitalReturn > (best?.capitalReturn ?? 0) ? round : best, undefined)
  const number = (round: ArbitrageRoundResult) => String(result.rounds.indexOf(round) + 1).padStart(2, '0')
  const parts: string[] = []
  if (result.totalReturnPercent < 0 && worst) {
    parts.push(`Наибольший убыток — в раунде ${number(worst)} (${formatEdge(worst.capitalReturn * 100)}).`)
    if (worst.grossReturn < 0) {
      parts.push('Выбранный маршрут был убыточным ещё до комиссий.')
    } else if (worst.grossReturn > 0 && worst.feeReturn !== undefined && worst.feeReturn >= worst.grossReturn) {
      parts.push('Комиссии полностью поглотили положительную разницу цен.')
    } else if (worst.liquidityHit && worst.netBeforeLiquidity > 0 && worst.netReturn < 0) {
      parts.push('Исполнение объёма по менее выгодным ценам привело к убытку после издержек.')
    }
    const profits = executed.reduce((sum, round) => sum + Math.max(0, round.capitalReturn), 0)
    if (profits > 0) parts.push(profits < -worst.capitalReturn
      ? 'Прибыль остальных сделок не компенсировала эту потерю.'
      : 'Суммарные убытки превысили прибыль остальных сделок.')
  } else if (result.totalReturnPercent > 0 && best) {
    parts.push(`Наибольший положительный вклад — раунд ${number(best)} (${formatEdge(best.capitalReturn * 100)}).`)
    parts.push(worst ? 'Прибыльные сделки перекрыли суммарные убытки.' : 'Исполненные сделки не принесли убытков.')
  } else if (result.totalReturnPercent === 0) {
    parts.push(worst && best ? 'Прибыль и убытки взаимно компенсировались; капитал не изменился.'
      : executed.length ? 'Исполненные сделки не изменили капитал.' : 'Сделок не было, капитал не изменился.')
  } else {
    parts.push(`Итог прохождения — ${formatEdge(result.totalReturnPercent)}. Данных для объяснения вкладов раундов недостаточно.`)
  }
  if (counts.timedOut) parts.push(counts.timedOut === 1 ? 'Один раунд завершился по истечении времени без сделки.'
    : `${counts.timedOut} ${plural(counts.timedOut, ['раунд', 'раунда', 'раундов'])} завершились по истечении времени без сделки.`)
  const declined = result.rounds.filter(round => round.choseNoTrade && !round.timedOut).length
  if (declined) parts.push(declined === 1 ? 'В одном раунде вы отказались от сделки.' : `В ${declined} раундах вы отказались от сделки.`)
  return parts.join(' ')
}

export function resultNextStep(state: Pick<GameState, 'completedChallenges' | 'unlockedChallenges' | 'advancedResults'>, advanced: boolean) {
  const complete = CHALLENGE_ORDER.every(type => state.completedChallenges.includes(type))
  if (complete) return { complete, to: '/profile', label: 'Посмотреть мой профиль' }
  const entry = gameEntry({ ...state, selectedMode: advanced ? 'advanced' : 'standard' })
  if (advanced && entry.to === '/#trials') return { complete, to: '/play', label: 'Результаты режимов' }
  return { complete, to: entry.to, label: entry.to === '/#trials' ? 'Выбрать испытание' : 'Продолжить испытания' }
}
