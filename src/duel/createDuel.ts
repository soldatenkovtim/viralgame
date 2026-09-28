import type { ResultPayload } from '@/store/gameStore'
import { scenarioCatalog } from '@/modes/scenarios'
import type { DuelPayload, DuelPlayerResult } from './types'
const actions: Record<string, string> = {
  long: 'Лонг', short: 'Шорт', flat: 'Вне рынка', hold: 'Держать', increase: 'Увеличить', reduce: 'Сократить',
  close: 'Закрыть', flip: 'Перевернуться', hedge: 'Хеджировать', 'enter-long': 'Войти в лонг', 'enter-short': 'Войти в шорт', 'stay-flat': 'Остаться вне рынка',
}
export function summarizeResult(payload: ResultPayload): DuelPlayerResult {
  switch (payload.challengeType) {
    case 'blind-market': {
      const r = payload.result
      const scenario = scenarioCatalog['blind-market'].find(s => s.id === r.scenarioId)!
      return { score: r.score, metrics: { 'Прибыль, %': r.pnlPercent, 'Макс. просадка, %': r.maxDrawdown,
        'Макс. экспозиция, %': Math.max(0, ...r.decisions.map(d => Math.abs(d.exposure) * 100)),
        'Время решения, с': r.timeToDecision.reduce((a, b) => a + b, 0) / Math.max(1, r.timeToDecision.length) / 1000 },
        decisions: r.decisions.map(d => ({ label: `${actions[d.action ?? d.direction]} · ${Math.round(Math.abs(d.exposure) * 100)}%`,
          candleIndex: scenario.checkpoints[d.checkpointIndex] - 1, price: d.priceAtDecision, exposure: d.exposure })) }
    }
    case 'market-maker': {
      const r = payload.result
      return { score: r.score, metrics: { 'Прибыль': r.pnl, 'Доход от спреда': r.spreadPnl, 'Переоценка позиции': r.inventoryPnl,
        'Расходы на хедж': r.hedgeCosts, 'Макс. позиция': r.maxInventory, 'Время сверх лимита, с': r.secondsAboveSoftLimit }, decisions: [] }
    }
    case 'black-swan': {
      const r = payload.result
      const scenario = scenarioCatalog['black-swan'].find(s => s.id === r.scenarioId)!
      return { score: r.score, metrics: { 'Прибыль, %': r.pnlPercent, 'Макс. просадка, %': r.maxDrawdown,
        'Макс. экспозиция, %': r.maxExposure * 100, 'Цена выхода': r.decisions.find(d => d.positionAfter === 0)?.price ?? '—',
        'Время решения, с': r.averageDecisionMs / 1000 },
        decisions: r.decisions.map(d => ({ label: actions[d.action], price: d.price, exposure: d.positionAfter, candleIndex: scenario.phaseCheckpoints[d.phase - 1] - 1 })) }
    }
    case 'cross-arbitrage': {
      const r = payload.result
      return { score: r.score, metrics: { 'Чистая прибыль, %': r.totalReturnPercent, 'Время решения, с': r.averageDecisionMs / 1000,
        'Лучший чистый доход, %': r.bestEdgePercent, 'Сделок': r.tradeCount },
        decisions: r.rounds.map(d => ({ label: d.choseNoTrade ? `Сделки нет · ${(d.decisionTimeMs / 1000).toFixed(1)} с` :
          `${venueName(d.buyVenue)} → ${venueName(d.sellVenue)} · ${Math.round(d.positionSize * 100)} ед. · чистый доход ${(d.netReturn * 100).toFixed(3)}% · проскальзывание −${((d.slippageReturn ?? 0) * 100).toFixed(3)}% · ${(d.decisionTimeMs / 1000).toFixed(1)} с` })) }
    }
  }
}
function venueName(id?: string) { return ({ alpha: 'Альфа', beta: 'Бета', gamma: 'Гамма', delta: 'Дельта', epsilon: 'Эпсилон' } as Record<string, string>)[id ?? ''] ?? '—' }
export function createDuel(payload: ResultPayload): DuelPayload {
  return { version: 1, mode: 'duel', challengeType: payload.challengeType, seed: payload.result.seed,
    scenarioId: payload.result.scenarioId, challengerResult: summarizeResult(payload), createdAt: new Date().toISOString() }
}
export function encodeDuel(payload: DuelPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function duelUrl(payload: DuelPayload): string {
  return `${window.location.origin}/duel/${payload.challengeType}?data=${encodeDuel(payload)}`
}
