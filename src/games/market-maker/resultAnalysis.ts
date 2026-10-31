import type { MarketMakerResult, MMPhaseStats } from '@/types/game'
import { formatSigned } from '@/lib/formatting'

/** Presentation only: retain engine precision until formatting. */
export function financialNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 100) / 100
  return formatSigned(rounded, 2)
}

export function roundObservation(r: MarketMakerResult): string {
  if (r.tradeCount === 0) return 'В этом раунде не было исполненных заявок; оценивать вклад исполнения котировок по нему нельзя.'
  const components = [
    {name: 'исполнение относительно рынка', value: r.spreadPnl},
    {name: 'переоценка накопленной позиции', value: r.inventoryPnl},
    {name: 'хеджирование', value: -r.hedgeCosts},
    {name: 'комиссии', value: -(r.transactionCosts ?? 0)},
    {name: 'удержание позиции', value: -(r.carryCosts ?? 0)},
  ]
  if (!Number.isFinite(r.pnl) || !Number.isFinite(r.tradeCount) || components.some(c => !Number.isFinite(c.value)) || Math.abs(components.reduce((s,c) => s+c.value,0)-r.pnl)>0.01) return 'Сохранённых финансовых данных недостаточно для согласованного разбора вкладов в итоговый PnL.'
  const positive = components.filter(c => c.value > 0).sort((a,b)=>b.value-a.value)
  const negative = components.filter(c => c.value < 0).sort((a,b)=>a.value-b.value)
  const up = positive.reduce((s,c)=>s+c.value,0)
  const down = -negative.reduce((s,c)=>s+c.value,0)
  if (up === 0 && down === 0) return 'Финансовые компоненты и итоговый PnL равны нулю.'
  const nearZero = Math.abs(r.pnl) < 0.5 || (up > 0 && down > 0 && Math.abs(r.pnl) <= Math.max(up,down)*0.05)
  if (nearZero && up > 0 && down > 0) return `Положительные вклады (${financialNumber(up)}) и отрицательные (${financialNumber(-down)}) почти компенсировали друг друга. Крупнейшие компоненты — ${positive[0].name} (${financialNumber(positive[0].value)}) и ${negative[0].name} (${financialNumber(negative[0].value)}).`
  const dominant = r.pnl >= 0 ? positive[0] : negative[0]
  if (!dominant) return 'Итоговый PnL близок к нулю; выраженного финансового вклада нет.'
  const first = `Главный источник ${r.pnl >= 0 ? 'прибыли' : 'убытка'} — ${dominant.name} (${financialNumber(dominant.value)}).`
  const opposite = r.pnl >= 0 ? negative : positive
  const rest = components.filter(c=>c!==dominant && c.value!==0)
  const contributors = opposite.length ? opposite : rest
  if (!contributors.length) return first
  const names = contributors.map(c=>c.name)
  const list = names.length > 1 ? `${names.slice(0,-1).join(', ')} и ${names.at(-1)}` : names[0]
  const total = contributors.reduce((sum,c)=>sum+c.value,0)
  const verb = total < 0 ? 'уменьшили' : 'увеличили'
  const subject = list.charAt(0).toUpperCase()+list.slice(1)
  return `${first} ${subject} ${opposite.length ? '' : 'дополнительно '}${contributors.length === 1 ? (total < 0 ? 'уменьшает' : 'увеличивает') : verb} результат на ${financialNumber(Math.abs(total)).replace('+','')} игровых единиц.`
}

export function phaseComment(p: MMPhaseStats): string {
  const mechanism = p.regime === 'informed' ? 'Контрагенты действовали с учётом будущего движения справедливой цены.' : p.regime === 'momentum' ? 'Поток заявок реагировал на движение рыночной цены.' : 'Покупки и продажи небольшого размера без выраженного направленного потока.'
  if (p.fills === 0) return `${mechanism} Исполнений не было.`
  if (!Number.isFinite(p.pnlChange)) return mechanism
  return p.pnlChange < -0.005 ? `${mechanism} Итоговый результат периода отрицательный.` : mechanism
}

export function phaseReconciliation(r: MarketMakerResult): string {
  if (!r.phases?.length) return ''
  if (!Number.isFinite(r.pnl) || r.phases.some(p=>!Number.isFinite(p.pnlChange))) return ''
  const sum = r.phases.reduce((s,p)=>s+p.pnlChange,0)
  if (Math.abs(sum-r.pnl)>0.01) return `Сумма PnL фаз: ${financialNumber(sum)}; разница с итогом: ${financialNumber(r.pnl-sum)}. Сохранённая фазовая разбивка не включает все изменения между границами учёта и не является полной разбивкой итога.`
  const displayedSum = r.phases.reduce((total,p)=>total+Math.round(p.pnlChange*100),0)
  const displayedTotal = Math.round(r.pnl*100)
  return displayedSum !== displayedTotal ? `Разница ${financialNumber((displayedTotal-displayedSum)/100)} возникает при округлении PnL отдельных фаз до сотых.` : ''
}
