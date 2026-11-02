import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crossArbitrageScenarios, getCrossArbitrageScenario, getCrossArbitrageSession, sessionScenarios } from '@/data/crossArbitrageScenarios'
import { CHALLENGE_ORDER, useGameStore, type GameState, type SaveOutcome } from '@/store/gameStore'
import type { ArbitrageRoundResult, CrossArbitrageResult as Result, CrossArbitrageScenario } from '@/types/game'
import { bestTrade } from './engine'
import { buildCrossArbitrageResult, crossArbitrageTraits, evaluateRound, formatEdge } from './scoring'
import { resultCounts, resultNextStep, sessionObservation } from './resultPresentation'
import { CrossArbitrageResult, RoundHistory } from './CrossArbitrageResult'
import { roundPresentation } from './roundPresentation'
import { buildTradingProfile, scaleTrait } from '@/lib/profile'
import { advancedArbitrageScenarios } from '@/data/advanced/scenarios'
import { resolveRoundScenario, roundExecutionDisplay } from './roundDisplay'
import { RoundFeedback } from './RoundFeedback'

vi.mock('@/store/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('@/store/gameStore')>()
  return { ...actual, useGameStore: Object.assign(
    (selector: (state: GameState) => unknown) => selector(actual.useGameStore.getState()), actual.useGameStore,
  ) }
})
const initial = useGameStore.getInitialState()
afterEach(() => useGameStore.setState(initial))
const session = getCrossArbitrageSession('arb-clean-01')
const skip = { positionSize: 0, decisionTimeMs: 1000, timedOut: false }
const trade = { ...skip, buyVenue: 'alpha', sellVenue: 'beta', positionSize: 0.25 }
const outcome: SaveOutcome = { points: 3151, previousBest: 4000, pointsToBest: 849, isPersonalBest: false, unlockedNext: null, seriesCompleted: false }
const makeResult = (rounds = sessionScenarios(session).map(s => evaluateRound(s, skip))) => buildCrossArbitrageResult(session, rounds)
const render = (result: Result, saved = outcome) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CrossArbitrageResult, { session, result, outcome: saved })))
const history = (id: string, decision = trade) => {
  const scenario = getCrossArbitrageScenario(id)
  const round = evaluateRound(scenario, decision)
  return { round, scenario, html: renderToStaticMarkup(createElement(RoundHistory, { round, scenario, index: 4 })) }
}

describe('Final arbitrage result presentation', () => {
  it('counts five profitable trades from actual unrounded capital contributions', () => {
    const scenarios = crossArbitrageScenarios.filter(s => bestTrade(s.quotes).capitalReturn > 0).slice(0, 5)
    const result = makeResult(scenarios.map(s => evaluateRound(s, { ...trade, ...bestTrade(s.quotes) })))
    expect(resultCounts(result)).toMatchObject({ profitable: 5, losing: 0, skipped: 0 })
    expect(sessionObservation(result)).toContain('Наибольший положительный вклад')
    expect(result.totalReturnPercent).toBe(result.rounds.reduce((sum, r) => sum + r.capitalReturn, 0) * 100)
    expect(render(result)).toContain(formatEdge(result.totalReturnPercent))
  })
  it('counts all losing trades and explains a route negative before costs', () => {
    const result = makeResult(sessionScenarios(session).map(s => evaluateRound(s, { ...trade, buyVenue: 'beta', sellVenue: 'alpha' })))
    expect(resultCounts(result)).toMatchObject({ profitable: 0, losing: 5, skipped: 0 })
    const observation = sessionObservation(result)
    expect(observation).toContain('Наибольший убыток')
    expect(observation).toContain('ещё до комиссий')
  })
  it('distinguishes fully passive play from five timeouts', () => {
    const passive = makeResult()
    const timeout = makeResult(sessionScenarios(session).map(s => evaluateRound(s, { ...skip, timedOut: true, decisionTimeMs: 15000 })))
    expect(resultCounts(passive)).toMatchObject({ skipped: 5, timedOut: 0 })
    expect(resultCounts(timeout)).toMatchObject({ skipped: 5, timedOut: 5 })
    expect(sessionObservation(passive)).toContain('Сделок не было, капитал не изменился.')
    expect(sessionObservation(passive)).not.toContain('по тайм-ауту')
    expect(sessionObservation(timeout)).toContain('5 раундов завершились по истечении времени без сделки')
    expect(render(passive)).not.toContain('Все четыре стандартных испытания пройдены')
  })
  it('handles mixed results, exact zero and the engine false-trade classification separately', () => {
    const base = getCrossArbitrageScenario('arb_btc_obvious')
    const flat: CrossArbitrageScenario = { ...base, quotes: base.quotes.map(q => ({ ...q, bid: 100, ask: 100, feeRate: 0 })) }
    const result = makeResult([
      evaluateRound(base, trade), evaluateRound(base, { ...trade, buyVenue: 'beta', sellVenue: 'alpha' }),
      evaluateRound(flat, trade), evaluateRound(base, skip), evaluateRound(base, { ...skip, timedOut: true }),
    ])
    expect(resultCounts(result)).toEqual({ profitable: 1, losing: 1, flat: 1, skipped: 2, timedOut: 1 })
    expect(result.falseTrades).toBe(2)
    expect(sessionObservation(result)).toContain('Прибыль остальных сделок не компенсировала эту потерю')
    expect(render(result)).toContain('Классификация скоринга: убыточные и нулевые сделки')
  })
  it.each([
    ['arb_btc_obvious', 0.25], ['arb_x_false', 1], ['arb_x_liquidity', 1], ['arb_btc_liquidity', 1],
  ])('retains saved execution and costs for %s at size %s', (id, positionSize) => {
    const { round, html } = history(String(id), { ...trade, positionSize: Number(positionSize) })
    expect(html).toContain(`<dd>${formatEdge(round.netReturn * 100)}</dd>`)
    expect(html).toContain(`<dd>${formatEdge(-round.feeReturn! * 100)}</dd>`)
    expect(html).toContain(`<dd>${formatEdge(-round.slippageReturn! * 100)}</dd>`)
    expect(html).toContain(`${Number(positionSize) * 100} ед.`)
    expect(html).toContain('Средняя цена покупки')
    expect(html).not.toMatch(/Gross spread|Slippage|Net result|[Ee]dge/)
    if (round.liquidityHit) expect(html).toContain('Часть сделки исполнена на следующих уровнях')
  })
  it('uses the same alternatives as intermediate results and does not invent one', () => {
    const partial = history('arb_x_multiple_liq', { ...trade, positionSize: 0.1 })
    expect(partial.html).toContain(roundPresentation(partial.round, partial.scenario).comparisonTitle)
    const best = bestTrade(partial.scenario.quotes)
    const full = history(partial.scenario.id, { ...trade, ...best })
    expect(full.html).not.toContain('arb-history-alternative')
    const absent = history('arb_x_none', skip)
    expect(absent.html).not.toContain('arb-history-alternative')
    expect(absent.html).toContain('Прибыльных маршрутов после комиссий и издержек не было.')
  })
  it('reports expired opportunities and timeouts without claims about other players', () => {
    const { html } = history('arb_eth_dynamic', { ...skip, decisionTimeMs: 15000, timedOut: true })
    expect(html).toContain('Время вышло — сделки нет')
    expect(html).toContain('К моменту решения она закрылась')
    expect(html).toContain('Возможность в начале раунда')
    expect(html).not.toMatch(/другие участники|Сделка пропущена|Средняя цена покупки/)
    const early = history('arb_eth_dynamic', skip)
    expect(early.html).toContain('Сделка пропущена')
    expect(early.html).toContain('На рынке была доступна прибыльная возможность.')
    expect(early.html).not.toContain('закрылась')
  })
  it('keeps five native disclosures closed and groups navigation in one next section', () => {
    const html = render(makeResult())
    expect(html.match(/<details class="arb-history-round">/g)).toHaveLength(5)
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    expect(html).toContain('Дополнительная статистика')
    expect(html.match(/Что дальше/g)).toHaveLength(1)
    expect(html).toContain('Попробовать другой сценарий')
    expect(html).toContain('href="/#trials"')
    expect(html).toContain('href="/profile"')
  })
  it('preserves profile figures and personal best on repeat play', () => {
    const result = makeResult()
    const traits = crossArbitrageTraits(result)
    useGameStore.setState({ completedChallenges: CHALLENGE_ORDER })
    const html = render(result)
    for (const value of Object.values(traits)) expect(html).toContain(`aria-valuenow="${scaleTrait(value)}"`)
    expect(html).toContain('Ваш результат по трём характеристикам')
    expect(html).not.toContain('Ваш торговый профиль сформирован')
    expect(html).toContain('Оценки отражают ваши решения в испытании «Кросс-арбитраж». Общий торговый профиль объединяет результаты всех испытаний.')
    expect(html).toContain('Посмотреть мой профиль')
    expect(html).toContain('До лучшего результата:')
    expect(html).not.toContain('ПРОФИЛЬ ТРЕЙДЕРА')
    expect(render(result, { ...outcome, isPersonalBest: true })).toContain('Новый личный результат')
  })
  it('labels attempt scores separately from the stored aggregate profile and never modifies it', () => {
    const savedProfile = { ...buildTradingProfile({}), opportunity: 99, discipline: 98, adaptability: 97 }
    useGameStore.setState({ tradingProfile: savedProfile, completedChallenges: CHALLENGE_ORDER })
    const result = makeResult()
    const html = render(result)
    for (const value of Object.values(crossArbitrageTraits(result))) expect(html).toContain(`aria-valuenow="${scaleTrait(value)}"`)
    expect(html).toContain('Оценки отражают ваши решения в испытании «Кросс-арбитраж»')
    expect(html).toContain('Общий торговый профиль объединяет результаты всех испытаний')
    expect(html).not.toContain('Ваши текущие игровые характеристики по результатам пройденных испытаний')
    expect(useGameStore.getState().tradingProfile).toEqual(savedProfile)
  })
  it.each([false, true])('uses persisted completion for first and repeated series finish (%s)', seriesCompleted => {
    useGameStore.setState({ completedChallenges: CHALLENGE_ORDER, unlockedChallenges: CHALLENGE_ORDER })
    const html = render(makeResult(), { ...outcome, seriesCompleted })
    expect(html).toContain('Все четыре стандартных испытания пройдены')
    expect(resultNextStep(useGameStore.getState(), false)).toMatchObject({ to: '/profile', complete: true })
  })
  it('respects real unlocks and does not count advanced completions or a stale save outcome as standard progress', () => {
    useGameStore.setState({ completedChallenges: ['cross-arbitrage'], unlockedChallenges: ['blind-market', 'cross-arbitrage'] })
    expect(resultNextStep(useGameStore.getState(), false)).toMatchObject({ to: '/challenge/blind-market', complete: false })
    expect(render(makeResult(), { ...outcome, seriesCompleted: true })).not.toContain('профиль сформирован')
    useGameStore.setState({ completedChallenges: ['blind-market'], unlockedChallenges: ['blind-market'] })
    expect(resultNextStep(useGameStore.getState(), false).to).toBe('/#trials')
    useGameStore.setState({ advancedResults: CHALLENGE_ORDER.map(challengeType => ({ challengeType, scenarioId: 'test', score: 80, completedAt: '' })) })
    expect(resultNextStep(useGameStore.getState(), true).complete).toBe(false)
  })
})


describe('Historical arbitrage result data', () => {
  it.each([...crossArbitrageScenarios, ...advancedArbitrageScenarios])('resolves $id without a current session match', scenario => {
    const round = evaluateRound(scenario, trade)
    const html = renderToStaticMarkup(createElement(RoundHistory, { round, index: 0 }))
    expect(html).toContain(`<strong>${scenario.asset}</strong>`)
    expect(html).not.toContain(scenario.id)
    const execution = roundExecutionDisplay(round)
    expect(html).toContain(execution.summary)
    expect(html).toContain(`<dd>${execution.route}</dd>`)
    expect(html).toContain(`<dd>${execution.size}</dd>`)
    expect(html).not.toContain('Сделки нет')
    const intermediate = renderToStaticMarkup(createElement(RoundFeedback, { round, scenario, remainingMs: 1000, durationMs: 1500, finalRound: false }))
    expect(intermediate).toContain(`<dd>${execution.route}</dd>`)
    expect(intermediate).toContain(`<dd>${execution.size}</dd>`)
  })

  it('uses saved round IDs even when the currently selected session has changed', () => {
    const result = makeResult(sessionScenarios(session).map(s => evaluateRound(s, trade)))
    const before = structuredClone(result)
    const otherSession = getCrossArbitrageSession('arb-liquidity-01')
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CrossArbitrageResult, { session: otherSession, result, outcome })))
    expect(html).toContain('<strong>BTC / USDT</strong>')
    expect(html).toContain('Alpha → Beta · 25 ед.')
    expect(html).not.toContain('>arb_btc_obvious<')
    expect(html).not.toContain('>arb_x_false<')
    expect(html).not.toContain('>Сделки нет<')
    expect(result).toEqual(before)
  })

  it('supports new supplied scenarios and never substitutes a different market for unknown IDs', () => {
    const base = getCrossArbitrageScenario('arb_btc_obvious')
    const custom = { ...base, id: 'future-round', asset: 'NEW / USDT' }
    const round = evaluateRound(custom, trade)
    const known = renderToStaticMarkup(createElement(RoundHistory, { round, scenario: custom, index: 0 }))
    expect(known).toContain('<strong>NEW / USDT</strong>')
    expect(known).toContain('Alpha → Beta · 25 ед.')
    expect(resolveRoundScenario('missing')).toBeUndefined()
    const unknown = renderToStaticMarkup(createElement(RoundHistory, { round, index: 0 }))
    expect(unknown).toContain('Инструмент не указан')
    expect(unknown).toContain('Маршрут не сохранён · 25 ед.')
    expect(unknown).toContain('Сделка исполнена')
    expect(unknown).not.toMatch(/future-round|BTC|Сделки нет|arb-history-alternative/)
  })

  it('preserves available execution data when optional fields are absent in old records', () => {
    const scenario = getCrossArbitrageScenario('arb_btc_obvious')
    const full = evaluateRound(scenario, trade)
    const legacy = { ...full }
    for (const key of ['avgBuyPrice', 'avgSellPrice', 'feeReturn', 'slippageReturn', 'sizingScore', 'buyVenue', 'sellVenue'] as const) delete legacy[key]
    // The legacy record still identifies execution and volume, but contains no route or cost breakdown.
    const before = structuredClone(legacy)
    const html = renderToStaticMarkup(createElement(RoundHistory, { round: legacy, index: 0 }))
    expect(html).toContain('Сделка исполнена')
    expect(html).toContain('Маршрут не сохранён · 25 ед.')
    expect(html).toContain('<dd>Маршрут не сохранён</dd>')
    expect(html).toContain('<dd>25 ед.</dd>')
    expect(html).not.toMatch(/NaN|undefined|Сделки нет/)
    expect(legacy).toEqual(before)
    const partial = roundExecutionDisplay({ ...legacy, buyVenue: 'alpha' })
    expect(partial.route).toBe('Alpha → Площадка не указана')
    const missingSize = { ...legacy, positionSize: undefined, quoteStep: undefined } as unknown as ArbitrageRoundResult
    const incomplete = renderToStaticMarkup(createElement(RoundHistory, { round: missingSize, index: 0 }))
    expect(incomplete).toContain('Объём не сохранён')
    expect(incomplete).not.toMatch(/NaN|undefined|arb-history-alternative/)
    expect(roundExecutionDisplay({ ...legacy, buyVenue: 'alpha', sellVenue: 'beta' }).summary).toBe('Alpha → Beta · 25 ед.')
  })

  it('keeps intentional skips and timer expiry distinct in both summary and details', () => {
    const manual = history('arb_btc_obvious', skip).html
    const timeout = history('arb_btc_obvious', { ...skip, timedOut: true }).html
    expect(manual).toContain('Сделка пропущена')
    expect(manual).toContain('Отказ от сделки')
    expect(manual).not.toContain('Время на решение истекло')
    expect(timeout).toContain('Время вышло — сделки нет')
    expect(timeout).toContain('Время на решение истекло')
    expect(timeout).not.toContain('Отказ от сделки')
  })
})

describe('Analytical session observation', () => {
  const scenario = getCrossArbitrageScenario('arb_btc_obvious')
  const gain = evaluateRound(scenario, trade)
  const loss = evaluateRound(scenario, { ...trade, buyVenue: 'beta', sellVenue: 'alpha' })

  it('explains the largest loss, incomplete compensation and a timeout without repeating counts', () => {
    const result = makeResult([gain, loss, evaluateRound(scenario, { ...skip, timedOut: true })])
    const observation = sessionObservation(result)
    expect(observation).toContain(`раунде 02 (${formatEdge(loss.capitalReturn * 100)})`)
    expect(observation).toContain('убыточным ещё до комиссий')
    expect(observation).toContain('Прибыль остальных сделок не компенсировала эту потерю')
    expect(observation).toContain('Один раунд завершился по истечении времени без сделки')
    expect(observation).not.toMatch(/Прибыльных сделок|убыточных —|поглотили|дисциплин/)
  })

  it('explains positive, offsetting zero and flat outcomes', () => {
    const smallLoss = { ...loss, capitalReturn: -gain.capitalReturn / 2 }
    expect(sessionObservation(makeResult([gain, smallLoss]))).toContain('Прибыльные сделки перекрыли суммарные убытки')
    const offset = { ...loss, capitalReturn: -gain.capitalReturn }
    expect(sessionObservation(makeResult([gain, offset]))).toBe('Прибыль и убытки взаимно компенсировались; капитал не изменился.')
    expect(sessionObservation(makeResult([{ ...gain, capitalReturn: 0, netReturn: 0 }]))).toBe('Исполненные сделки не изменили капитал.')
  })

  it('attributes costs only when saved financial figures confirm their effect', () => {
    const feeTrap = evaluateRound(getCrossArbitrageScenario('arb_x_false'), trade)
    expect(sessionObservation(makeResult([feeTrap]))).toContain('Комиссии полностью поглотили положительную разницу цен')
    expect(sessionObservation(makeResult([{ ...feeTrap, feeReturn: undefined }]))).not.toContain('Комиссии полностью')
    const depth = evaluateRound(getCrossArbitrageScenario('arb_x_liquidity'), { ...trade, positionSize: 1 })
    expect(sessionObservation(makeResult([depth]))).toContain('Исполнение объёма по менее выгодным ценам')
    expect(sessionObservation(makeResult([loss]))).not.toContain('Комиссии полностью')
  })

  it('provides a neutral fallback when contribution data is incomplete', () => {
    const incomplete = { ...makeResult([gain]), rounds: [{ ...gain, capitalReturn: undefined } as unknown as ArbitrageRoundResult] }
    expect(sessionObservation(incomplete)).toContain('Данных для объяснения вкладов раундов недостаточно')
    expect(sessionObservation(incomplete)).not.toMatch(/NaN|Прибыльные сделки|убыток/)
  })
})
