import { MM_LOT_SIZE } from '@/data/marketMakerScenarios'
import { formatNumber } from '@/lib/formatting'
import type { MMAccountingDebug } from '@/types/game'

export function AccountingDebug({ data }: { data: MMAccountingDebug }) {
  const rows = [
    ['Cash', data.cash],
    ['Initial capital', data.initialCapital],
    ['Inventory (единицы)', data.inventoryUnits],
    ['Average inventory entry', data.averageEntry],
    ['Current mark price', data.markPrice],
    ['Inventory MTM PnL (открытая позиция)', data.openInventoryPnl],
    ['Realized PnL (до costs)', data.realizedPnl],
    ['Transaction costs (списаны из Cash)', data.transactionCosts],
    ['Hedge costs', data.hedgeCosts],
    ['Carry costs (списаны из Cash)', data.carryCosts],
    ['Total PnL', data.totalPnl],
  ] as const
  return (
    <details className="rounded-xl border border-ink-700 bg-ink-900 p-5 text-xs text-chalk-400">
      <summary className="cursor-pointer">PnL debug</summary>
      <dl className="tnum mt-4 flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd>{value === null ? '—' : formatNumber(value, 2)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4">1 лот = {MM_LOT_SIZE} единиц. Для short средняя цена входа — средняя цена продаж оставшейся позиции.</p>
      <p className="mt-2">Total = Cash + Inventory × Mark − Initial capital − Hedge costs.</p>
      <p className="mt-2">Total = Realized + Unrealized − Transaction costs − Carry costs − Hedge costs.</p>
    </details>
  )
}
