import type { ReactNode } from 'react'
import { SectionLabel } from '@/components/ui/Card'

export interface ComparisonRow {
  label: string
  mine: string
  theirs: string
  mineTone?: 'up' | 'down' | 'neutral'
  theirsTone?: 'up' | 'down' | 'neutral'
  /** Подсветить строку, если решения разошлись. */
  diverged?: boolean
}

const toneClass = {
  up: 'text-market-up',
  down: 'text-market-down',
  neutral: 'text-chalk-50',
}

export function ComparisonTable({
  rows,
  theirName = 'Другой игрок',
}: {
  rows: ComparisonRow[]
  theirName?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 border-b border-ink-800 px-6 py-4">
        <SectionLabel>Решение</SectionLabel>
        <div className="text-[11px] font-medium tracking-[0.18em] text-violet-soft uppercase">
          Ты
        </div>
        <div className="text-[11px] font-medium tracking-[0.18em] text-chalk-500 uppercase">
          {theirName}
        </div>
      </div>

      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={`grid grid-cols-[1fr_1fr_1fr] items-baseline gap-4 border-b border-ink-800 px-6 py-4 last:border-b-0 ${
            row.diverged ? 'bg-violet-dim/20' : ''
          }`}
        >
          <span className="text-sm text-chalk-400">{row.label}</span>
          <span className={`tnum text-base ${toneClass[row.mineTone ?? 'neutral']}`}>
            {row.mine}
          </span>
          <span
            className={`tnum text-base ${
              row.theirsTone ? toneClass[row.theirsTone] : 'text-chalk-400'
            }`}
          >
            {row.theirs}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Ghost comparison: решения обоих игроков на одной временной шкале.
 * Создаёт ощущение асинхронного PvP без матчмейкинга.
 */
export function GhostTimeline({
  entries,
  theirName = 'другой игрок',
}: {
  entries: { moment: string; mine: string; theirs: string }[]
  theirName?: string
}) {
  return (
    <ol className="flex flex-col gap-5">
      {entries.map((entry, index) => {
        const diverged = entry.mine !== entry.theirs
        return (
          <li key={index} className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
              {entry.moment}
            </span>
            <div className="flex flex-col gap-1.5">
              <GhostRow color="violet" name="ты" value={entry.mine} />
              <GhostRow
                color={diverged ? 'chalk' : 'chalk'}
                name={theirName}
                value={entry.theirs}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function GhostRow({
  color,
  name,
  value,
}: {
  color: 'violet' | 'chalk'
  name: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          color === 'violet' ? 'bg-violet-accent' : 'border border-chalk-500 bg-transparent'
        }`}
        aria-hidden
      />
      <span className="w-28 shrink-0 text-sm text-chalk-500">{name}:</span>
      <span className="text-sm text-chalk-50">{value}</span>
    </div>
  )
}

export function ComparisonNarrative({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
      <p className="max-w-3xl text-lg leading-relaxed font-light text-chalk-50">
        {children}
      </p>
    </div>
  )
}
