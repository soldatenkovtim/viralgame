import { useEffect } from 'react'
import { CandleChart, type ChartMarker } from '@/components/charts/CandleChart'
import { scenarioCatalog } from '@/modes/scenarios'
import { trackEvent } from '@/lib/analytics'
import type { DuelPayload, DuelPlayerResult } from './types'
import { DuelShareButton } from './DuelResultShare'
export function DuelComparison({ payload, yours }: { payload: DuelPayload; yours: DuelPlayerResult }) {
  const other = payload.challengerResult
  const scenario = scenarioCatalog[payload.challengeType].find(s => s.id === payload.scenarioId)!
  useEffect(() => { trackEvent('duel_comparison_viewed', { challengeType: payload.challengeType }) }, [payload.challengeType])
  const markers: ChartMarker[] = [yours, other].flatMap((r, player) => r.decisions.filter(d => d.candleIndex !== undefined).map((d, index) => ({
    candleIndex: d.candleIndex!, position: player === 0 ? 'belowBar' : 'aboveBar', shape: player === 0 ? 'arrowUp' : 'square',
    color: player === 0 ? '#9b84ff' : '#f5bd69', text: `${player === 0 ? 'Ты' : 'Другой трейдер'}${index === 0 && d.exposure !== 0 && payload.challengeType === 'blind-market' ? ' вошёл здесь' : ''}: ${d.label}`,
  })))
  const observation = payload.challengeType === 'market-maker'
    ? Number(yours.metrics['Доход от спреда']) > Number(other.metrics['Доход от спреда']) && Number(yours.metrics['Макс. позиция']) > Number(other.metrics['Макс. позиция'])
      ? 'Ты собрал больше дохода от спреда, но держал больший позиционный риск.' : 'Сравни доход от спреда с переоценкой позиции и расходами на хедж: итог зависит от всех трёх составляющих.'
    : payload.challengeType === 'cross-arbitrage'
      ? 'Сравни каждый маршрут, размер и время решения. Более быстрое исполнение не всегда сохраняет больше прибыли после проскальзывания.'
      : 'Сравни прибыль с максимальной просадкой и размером позиции. Один рынок допускает разные подходы к риску.'
  return <main className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-12">
    <p className="text-sm text-violet-soft">Дуэль завершена</p><h1 className="text-3xl text-chalk-50">Два подхода к одному рынку</h1>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm text-chalk-200"><thead><tr><th className="p-3">Показатель</th><th className="p-3">Ты</th><th className="p-3">Другой трейдер</th></tr></thead>
      <tbody>{Object.entries(yours.metrics).map(([key, value]) => <tr key={key} className="border-t border-ink-700"><th className="p-3 font-normal text-chalk-400">{key}</th><td className="p-3">{display(value)}</td><td className="p-3">{display(other.metrics[key])}</td></tr>)}</tbody></table></div>
    {yours.decisions.length > 0 && <div className="grid grid-cols-2 gap-4">{[yours, other].map((r, i) => <section key={i} className="rounded-xl border border-ink-700 p-4"><h2 className="mb-4 text-sm text-chalk-400">{i === 0 ? 'Твои решения' : 'Другой трейдер'}</h2><ol className="space-y-3 text-sm text-chalk-50">{r.decisions.map((d, j) => <li key={j}>{j + 1}. {d.label}</li>)}</ol></section>)}</div>}
    {payload.challengeType === 'blind-market' && 'candles' in scenario && <section><h2 className="mb-3 text-sm text-chalk-200">Решения на одном графике · стрелки — ты, квадраты — другой трейдер</h2><CandleChart candles={scenario.candles.slice(Math.max(0, (markers[0]?.candleIndex ?? 0) - 96))} visibleCount={scenario.candles.length} markers={markers.map(m => ({ ...m, candleIndex: m.candleIndex - Math.max(0, (markers[0]?.candleIndex ?? 0) - 96) }))} /></section>}
    <p className="text-sm text-chalk-400">{observation}</p>
    <p className="text-xs text-chalk-500">Результат по игровым очкам: {Math.round(yours.score * 100)} против {Math.round(other.score * 100)}</p>
    <DuelShareButton original={{ ...payload, challengerResult: yours, createdAt: new Date().toISOString() }} />
  </main>
}
function display(value: string | number) { return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : value }
