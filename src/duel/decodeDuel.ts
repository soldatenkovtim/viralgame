import { scenarioCatalog } from '@/modes/scenarios'
import type { ChallengeType } from '@/types/game'
import type { DuelPayload } from './types'
const keys: Record<ChallengeType, string[]> = {
  'blind-market': ['Прибыль, %', 'Макс. просадка, %', 'Макс. экспозиция, %', 'Время решения, с'],
  'market-maker': ['Прибыль', 'Доход от спреда', 'Переоценка позиции', 'Расходы на хедж', 'Макс. позиция', 'Время сверх лимита, с'],
  'black-swan': ['Прибыль, %', 'Макс. просадка, %', 'Макс. экспозиция, %', 'Цена выхода', 'Время решения, с'],
  'cross-arbitrage': ['Чистая прибыль, %', 'Время решения, с', 'Лучший чистый доход, %', 'Сделок'],
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12
export function decodeDuel(data: string | null, challengeType?: string): DuelPayload | null {
  try {
    if (!data || data.length > 24000 || !/^[A-Za-z0-9_-]+$/.test(data)) return null
    const raw = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
    const p = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0)))) as DuelPayload
    if (!p || p.version !== 1 || p.mode !== 'duel' || !Object.hasOwn(scenarioCatalog, p.challengeType)) return null
    if (challengeType && challengeType !== p.challengeType) return null
    const scenario = scenarioCatalog[p.challengeType].find(s => s.id === p.scenarioId)
    if (!scenario || scenario.seed !== p.seed || typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt))) return null
    const r = p.challengerResult
    if (!r || !finite(r.score) || r.score < 0 || r.score > 100 || !r.metrics || typeof r.metrics !== 'object') return null
    const required = keys[p.challengeType]
    if (Object.keys(r.metrics).length !== required.length || !required.every(k => Object.hasOwn(r.metrics, k) && (finite(r.metrics[k]) || (k === 'Цена выхода' && r.metrics[k] === '—')))) return null
    if (!Array.isArray(r.decisions) || r.decisions.length > 5) return null
    if (p.challengeType === 'cross-arbitrage' && r.decisions.length !== 5) return null
    if (p.challengeType === 'market-maker' && r.decisions.length !== 0) return null
    if (p.challengeType === 'blind-market' && r.decisions.length !== 3) return null
    if (p.challengeType === 'black-swan' && (r.decisions.length < 1 || r.decisions.length > 3)) return null
    for (const d of r.decisions) {
      if (!d || typeof d.label !== 'string' || d.label.length > 240) return null
      if (d.price !== undefined && (!finite(d.price) || d.price <= 0)) return null
      if (d.exposure !== undefined && (!finite(d.exposure) || Math.abs(d.exposure) > 2)) return null
      if ('candles' in scenario && (!Number.isInteger(d.candleIndex) || d.candleIndex! < 0 || d.candleIndex! >= scenario.candles.length)) return null
    }
    return p
  } catch { return null }
}
