import { formatPercent } from '@/lib/formatting'
import type { MarketShockResult, MarketShockScenario, ShockDecision } from '@/types/game'
import { decisionCandleIndex, initialExposure, positionLabel } from './engine'

export function decisionPosition(decision: ShockDecision): string {
  return decision.positionBefore === decision.positionAfter
    ? positionLabel(decision.positionAfter)
    : `${positionLabel(decision.positionBefore)} → ${positionLabel(decision.positionAfter)}`
}

/** Explain exposure sensitivity using the recorded path, without alternative PnL estimates. */
export function sessionObservation(result: MarketShockResult, scenario: MarketShockScenario): string {
  const start = initialExposure(scenario)
  const end = result.decisions.at(-1)?.positionAfter ?? start
  const increased = result.decisions.some(d => Math.abs(d.positionAfter) > Math.abs(d.positionBefore))
  const decreased = result.decisions.some(d => Math.abs(d.positionAfter) < Math.abs(d.positionBefore))
  const exposures = [start, ...result.decisions.map(d => d.positionAfter)]
  const sizes = exposures.map(Math.abs)
  const side = start < 0 ? 'короткую' : 'длинную'
  let summary: string
  let meaning: string

  if (end === 0 && start !== 0) {
    summary = `Вы полностью закрыли исходную позицию ${positionLabel(start)}`
    meaning = 'После закрытия дальнейшее движение рынка не влияло на капитал через эту позицию.'
  } else if (increased && decreased) {
    summary = `В ходе сценария чистая экспозиция менялась от ${Math.round(Math.min(...sizes) * 100)}% до ${Math.round(Math.max(...sizes) * 100)}%, к завершению — ${positionLabel(end)}`
    meaning = 'Увеличение экспозиции повышало чувствительность капитала к движению рынка, а сокращение снижало её.'
  } else if (increased) {
    summary = `В ходе сценария вы увеличили ${side} позицию с ${Math.round(Math.abs(start) * 100)}% до ${Math.round(Math.abs(end) * 100)}%`
    meaning = 'Это повысило чувствительность капитала к дальнейшему движению рынка.'
  } else if (decreased) {
    const hedged = result.decisions.some(d => d.action === 'hedge' && d.positionAfter !== d.positionBefore)
    summary = `Вы снизили чистую экспозицию с ${positionLabel(start)} до ${positionLabel(end)}${hedged ? ' за счёт хеджирования' : ''}`
    meaning = 'Это уменьшило чувствительность капитала к дальнейшему движению рынка.'
  } else if (end === 0) {
    summary = 'Вы оставались вне рынка'
    meaning = 'Движение цены не влияло на капитал через позицию.'
  } else {
    summary = `В ходе сценария вы сохраняли экспозицию ${positionLabel(start)}`
    meaning = 'Размер позиции оставался прежним, сохраняя чувствительность капитала к движению рынка.'
  }

  const timeout = result.decisions.some(d => d.timedOut)
    ? ' (часть решений не подтверждена до истечения времени)' : ''
  const ending = result.pnlPercent > 0 ? `прибылью ${formatPercent(result.pnlPercent, 1, false)}`
    : result.pnlPercent < 0 ? `убытком ${formatPercent(Math.abs(result.pnlPercent), 1, false)}` : 'нулевым результатом'
  return `${summary}${timeout}. ${meaning} Итог — сценарий завершился ${ending} при максимальной просадке ${formatPercent(result.maxDrawdown, 1, false)}.`
}

export function exposureSegments(scenario: MarketShockScenario, result: MarketShockResult) {
  const end = scenario.candles.length - 1
  const segments = [
    { from: scenario.initialVisibleIndex - 1, exposure: initialExposure(scenario) },
    ...result.decisions.map(d => ({ from: decisionCandleIndex(scenario, d.phase), exposure: d.positionAfter })),
  ].filter((segment, index, all) => index === 0 || segment.exposure !== all[index - 1].exposure)
  return segments.map((segment, index) => ({ ...segment, to: segments[index + 1]?.from ?? end }))
}

export function sourceLabel(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname
    return host === 'finance.yahoo.com' ? 'Yahoo Finance' : host
  } catch { return 'Источник данных' }
}
