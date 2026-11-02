import { MM_SOFT_INVENTORY_LIMIT } from '@/data/marketMakerScenarios'
import { bestTrade, buildQuotePath, evaluateTrade } from '@/games/cross-arbitrage/engine'
import { resolveRoundScenario } from '@/games/cross-arbitrage/roundDisplay'
import { findScenarioById } from '@/modes/scenarios'
import { positionEvents } from '@/games/blind-market/positionAnalysis'
import { exposureLabel, formatNumber, formatPercent } from '@/lib/formatting'
import type { ProfileInput, TraitKey } from './profile'
import type { ArbitrageRoundResult, CrossArbitrageResult } from '@/types/game'

const finite = (...values: number[]) => values.every(Number.isFinite)
const percent = (value: number) => formatPercent(value * 100, 2)
const size = (value: number) => formatNumber(Math.abs(value) * 100, 0)

/** Only quotes visible at the saved decision step. Never use initial-best route
 * labels to claim a better alternative still existed after quotes converged. */
function roundContext(result: CrossArbitrageResult, round: ArbitrageRoundResult, index: number) {
  const session = findScenarioById('cross-arbitrage', result.scenarioId)
  const scenario = resolveRoundScenario(round.scenarioId, session?.scenarios)
  const label = `В «Кросс-арбитраже», раунд ${String(index + 1).padStart(2, '0')}`
  const buy = scenario?.quotes.find(q => q.venueId === round.buyVenue)?.venueName
  const sell = scenario?.quotes.find(q => q.venueId === round.sellVenue)?.venueName
  const route = buy && sell ? `${buy} → ${sell}` : 'выбранный маршрут'
  if (!scenario || !Number.isInteger(round.quoteStep) || round.quoteStep < 0) return { label, route }
  try {
    const quotes = buildQuotePath(scenario)[round.quoteStep]
    if (!quotes) return { label, route }
    const best = bestTrade(quotes)
    const selected = !round.choseNoTrade && round.buyVenue && round.sellVenue && round.positionSize > 0
      ? evaluateTrade(quotes, round.buyVenue, round.sellVenue, round.positionSize) : undefined
    // Do not reinterpret a legacy execution using a changed scenario/model.
    const comparable = selected && finite(round.netReturn) && Math.abs(selected.netReturn - round.netReturn) < 1e-8
    return { label, route, best, selected: comparable ? selected : undefined }
  } catch {
    return { label, route }
  }
}

/** One verifiable observation, scoped to its trial. No psychology or hindsight
 * labels of correct/incorrect. Return null rather than invent missing events. */
export interface ProfileFinding {
  summary: string
  detail: string
}

const finding = (summary: string, detail: string): ProfileFinding => ({ summary, detail })

export function observationFinding(trait: TraitKey, input: ProfileInput, strength: boolean): ProfileFinding | null {
  const { blindMarket: blind, marketMaker: maker, blackSwan: shock, crossArbitrage: arb } = input
  if (trait === 'riskControl') {
    const decisions = shock?.decisions.filter(d => !d.timedOut && finite(d.positionBefore, d.positionAfter)) ?? []
    if (strength) {
      const reduction = decisions.find(d => Math.abs(d.positionAfter) < Math.abs(d.positionBefore))
      if (reduction) return finding(`В шоке вы снизили экспозицию: ${size(reduction.positionBefore)}% → ${size(reduction.positionAfter)}%.`, `В «Рыночном шоке», решение ${reduction.phase}, вы сократили экспозицию с ${size(reduction.positionBefore)}% до ${size(reduction.positionAfter)}%. Размер открытого риска уменьшился; это не гарантировало прибыль.`)
      if (maker && maker.tradeCount > 0 && finite(maker.maxInventory, maker.secondsAboveSoftLimit)
        && maker.maxInventory <= MM_SOFT_INVENTORY_LIMIT && maker.secondsAboveSoftLimit === 0) {
        return finding(`В маркет-мейкинге позиция оставалась в пределах ${MM_SOFT_INVENTORY_LIMIT} лотов.`, `В «Маркет-мейкере» максимальный размер вашей позиции — ${formatNumber(maker.maxInventory)} лотов при мягком лимите ${MM_SOFT_INVENTORY_LIMIT}. Превышений лимита во время торговли не было.`)
      }
    } else {
      if (maker && Number.isFinite(maker.secondsAboveSoftLimit) && maker.secondsAboveSoftLimit > 0) return finding(`В маркет-мейкинге лимит позиции был превышен ${formatNumber(maker.secondsAboveSoftLimit, 1)} с.`, `В «Маркет-мейкере» вы удерживали позицию выше мягкого лимита ${MM_SOFT_INVENTORY_LIMIT} лотов в течение ${formatNumber(maker.secondsAboveSoftLimit, 1)} с. Время выше лимита снижает оценку контроля риска.`)
      const increase = decisions.find(d => finite(d.pnlBefore) && d.pnlBefore < 0 && Math.abs(d.positionAfter) > Math.abs(d.positionBefore))
      if (increase) return finding(`В шоке вы увеличили экспозицию при отрицательном результате.`, `В «Рыночном шоке», решение ${increase.phase}, при результате ${formatPercent(increase.pnlBefore)} вы увеличили экспозицию с ${size(increase.positionBefore)}% до ${size(increase.positionAfter)}%. Это увеличило открытый риск, независимо от дальнейшего движения цены.`)
    }
  }

  if (trait === 'pricing' && maker) {
    // Market price was visible; fair value was hidden. Do not imply the player
    // knew fair value or future markout when quoting.
    const trade = maker.trades?.find(t => {
      if (!finite(t.price, t.marketPriceAtTrade, t.size, t.tick) || t.size <= 0 || !['buy', 'sell'].includes(t.botSide)) return false
      const edge = t.botSide === 'buy' ? t.price - t.marketPriceAtTrade : t.marketPriceAtTrade - t.price
      return strength ? edge > 0 : edge < 0
    })
    if (trade) {
      const sold = trade.botSide === 'buy'
      return finding(`В маркет-мейкинге вы ${sold ? "продали" : "купили"} ${sold ? (strength ? "выше" : "ниже") : (strength ? "ниже" : "выше")} рыночной цены.`, `В «Маркет-мейкере» на шаге ${trade.tick} вы ${sold ? 'продали' : 'купили'} ${formatNumber(trade.size)} лотов по ${formatNumber(trade.price, 2)} при рыночной цене ${formatNumber(trade.marketPriceAtTrade, 2)}. Исполнение ${strength ? 'добавило' : 'уменьшило'} доход от спреда до комиссий; дальнейшая переоценка позиции учитывается отдельно.`)
    }
    if (finite(maker.pnl, maker.inventoryPnl, maker.spreadPnl)) {
      const net = maker.pnl - Math.max(0, maker.inventoryPnl)
      if ((strength && net > 0 && maker.spreadPnl > 0) || (!strength && net < 0)) return finding(`Результат котирования без положительной переоценки: ${formatNumber(net)} игровых единиц.`, `В «Маркет-мейкере» результат без положительной переоценки позиции — ${formatNumber(net, 0)} игровых единиц. Это совокупный результат котирования и издержек, а не оценка отдельного решения.`)
    }
  }

  if ((trait === 'discipline' || trait === 'opportunity' || trait === 'adaptability') && arb) {
    for (const [index, round] of arb.rounds.entries()) {
      const ctx = roundContext(arb, round, index)
      const executed = round.choseNoTrade === false && round.timedOut === false && finite(round.positionSize) && round.positionSize > 0
      if (trait === 'discipline') {
        if (!strength && executed && finite(round.grossReturn, round.netBeforeLiquidity, round.netReturn)) {
          if (round.grossReturn > 0 && round.netBeforeLiquidity < 0) return finding(`В арбитраже комиссии превышали преимущество выбранного маршрута.`, `${ctx.label}, вы исполнили ${ctx.route}: разница цен ${percent(round.grossReturn)}, после комиссий — ${percent(round.netBeforeLiquidity)} ещё до учёта объёма. Комиссии превышали ценовое преимущество уже в момент решения.`)
          if (round.liquidityHit && round.netBeforeLiquidity > 0 && round.netReturn <= 0) return finding(`В арбитраже выбранный объём поглотил преимущество после комиссий.`, `${ctx.label}, вы выбрали объём ${size(round.positionSize)} ед. для ${ctx.route}. Расчётная доходность после комиссий ${percent(round.netBeforeLiquidity)} снизилась до ${percent(round.netReturn)} с учётом исполнения объёма по доступной глубине.`)
          if (round.netReturn <= 0) return finding(`В арбитраже вы исполнили маршрут без положительной расчётной доходности.`, `${ctx.label}, вы исполнили ${ctx.route} объёмом ${size(round.positionSize)} ед. Расчётная доходность по котировкам в момент решения после издержек — ${percent(round.netReturn)}. Отказ от сделки сохранял капитал.`)
        }
        if (strength && round.choseNoTrade && !round.timedOut && round.optimalNetReturn <= 0 && ctx.best && ctx.best.capitalReturn <= 0) return finding(`В арбитраже вы отказались от сделки без доступного преимущества.`, `${ctx.label}, вы выбрали «Сделки нет». Среди доступных маршрутов и размеров не было положительной расчётной доходности после издержек.`)
        // A single good trade must not conceal contrary decisions in the same trial.
        if (strength && executed && round.netReturn > 0 && arb.rounds.every(r => r.choseNoTrade || (finite(r.netReturn) && r.netReturn > 0))) return finding(`В арбитраже вы выбрали сделку с положительной доходностью по расчёту.`, `${ctx.label}, вы исполнили ${ctx.route} объёмом ${size(round.positionSize)} ед. По котировкам в момент решения расчётная доходность после комиссий и глубины — ${percent(round.netReturn)}.`)
      }
      if (trait === 'opportunity' && ctx.best) {
        if (!strength && round.choseNoTrade && !round.timedOut && ctx.best.capitalReturn > 0) return finding(`В арбитраже вы отказались от доступной возможности.`, `${ctx.label}, вы выбрали «Сделки нет», хотя по доступным в тот момент котировкам существовал маршрут с расчётным вкладом в капитал ${percent(ctx.best.capitalReturn)} после издержек.`)
        if (executed && ctx.selected && ctx.best.capitalReturn > 0) {
          const gap = ctx.best.capitalReturn - ctx.selected.capitalReturn
          if (strength && Math.abs(gap) < 1e-8) return finding(`В арбитраже вы выбрали лучшие по расчёту маршрут и размер.`, `${ctx.label}, вы выбрали ${ctx.route}, ${size(round.positionSize)} ед. Этот маршрут и размер давали максимальный расчётный вклад в капитал по котировкам в момент решения: ${percent(ctx.best.capitalReturn)} после издержек.`)
          if (!strength && gap > 1e-8) return finding(`В арбитраже были доступны более доходные маршрут или размер.`, `${ctx.label}, вы выбрали ${ctx.route}, ${size(round.positionSize)} ед., с расчётным вкладом ${percent(ctx.selected.capitalReturn)}. Доступное сочетание маршрута и размера давало ${percent(ctx.best.capitalReturn)} по тем же котировкам после издержек.`)
        }
      }
      if (trait === 'adaptability') {
        if (!strength && round.timedOut) return finding(`В арбитраже время на решение истекло.`, `${ctx.label}, время на решение истекло. Модель адаптивности учитывает этот тайм-аут; он не означает, что вы сознательно отказались от сделки.`)
        if (strength && executed && finite(round.msBeforeClose ?? NaN, round.netReturn) && round.msBeforeClose! > 0 && round.netReturn > 0) return finding(`В арбитраже вы исполнили сделку до схождения котировок.`, `${ctx.label}, вы исполнили ${ctx.route} за ${formatNumber(round.msBeforeClose! / 1000, 1)} с до схождения котировок. Расчётная доходность после издержек в момент решения — ${percent(round.netReturn)}.`)
      }
    }
  }

  if (trait === 'discipline' && !strength) {
    const timeout = shock?.decisions.find(d => d.timedOut)
    if (timeout) return finding(`В шоке решение ${timeout.phase} завершилось по тайм-ауту.`, `В «Рыночном шоке», решение ${timeout.phase}, время истекло без вашего действия. За тайм-аут модель снижает оценку дисциплины; итоговая прибыльность здесь не является причиной вывода.`)
  }

  if ((trait === 'marketSense' || trait === 'adaptability') && blind
    && blind.segmentReturns.length === blind.decisions.length) {
    const events = positionEvents(blind.decisions, blind.stopHits)
    for (const [index, decision] of blind.decisions.entries()) {
      const move = blind.segmentReturns[index]
      if (!finite(decision.exposure, move) || decision.exposure === 0) continue
      if (trait === 'marketSense' && (strength ? decision.exposure * move > 0 : decision.exposure * move < 0)) return finding(`В слепом рынке ${exposureLabel(decision.exposure)} ${strength ? "совпал с последующим движением" : "оказался против последующего движения"}.`, `В «Слепом рынке», решение ${index + 1}, вы выбрали ${exposureLabel(decision.exposure)}. На следующем отрезке рынок изменился на ${formatPercent(move)}. Направление позиции ${strength ? 'оказалось удачным' : 'оказалось против движения'} на этом отрезке. Движение стало известно только после решения; этот результат сам по себе не подтверждает качество анализа или навык прогнозирования.`)
      const previous = blind.decisions[index - 1]
      if (trait === 'adaptability' && previous && finite(previous.exposure)
        && !['unknown', 'flat', 'hold', 'open-long', 'open-short'].includes(events[index])) {
        const benefit = (decision.exposure - previous.exposure) * move
        if (strength ? benefit > 0 : benefit < 0) return finding(`В слепом рынке изменение позиции ${strength ? "повысило" : "снизило"} игровую адаптивность.`, `В «Слепом рынке», решение ${index + 1}, вы изменили ${exposureLabel(previous.exposure)} на ${exposureLabel(decision.exposure)}. Следующий отрезок — ${formatPercent(move)}; изменение ${strength ? 'повысило' : 'снизило'} ретроспективный компонент адаптивности. Это не оценка правильности решения заранее.`)
      }
    }
  }
  return null
}

/** Full text for characteristic explanations and existing consumers. */
export function observationEvidence(trait: TraitKey, input: ProfileInput, strength: boolean): string | null {
  return observationFinding(trait, input, strength)?.detail ?? null
}
