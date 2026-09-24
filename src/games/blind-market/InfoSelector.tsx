import { Lock } from 'lucide-react'
import type { BlindInfoKey, BlindMarketScenario } from '@/types/game'

export const INFO_KEYS: BlindInfoKey[] = [
  'volume',
  'volatility',
  'correlation',
  'marketContext',
  'sector',
]

export const infoLabels: Record<BlindInfoKey, string> = {
  volume: 'Объём',
  volatility: 'Волатильность',
  correlation: 'Корреляция с индексом',
  marketContext: 'Рыночный фон',
  sector: 'Сектор',
}

export const MAX_INFO_SLOTS = 2

/**
 * Выбор источников информации — самостоятельное игровое решение.
 * Важно не только что игрок сделает, но и что он считает важным знать.
 */
export function InfoSelector({
  scenario,
  selected,
  onSelect,
}: {
  scenario: BlindMarketScenario
  selected: BlindInfoKey[]
  onSelect: (key: BlindInfoKey) => void
}) {
  const full = selected.length >= MAX_INFO_SLOTS

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {INFO_KEYS.map((key) => {
        const isSelected = selected.includes(key)
        const isLocked = isSelected || full

        return (
          <button
            key={key}
            type="button"
            disabled={isLocked}
            onClick={() => onSelect(key)}
            className={`flex min-h-24 flex-col items-start justify-between gap-3 rounded-xl border p-5 text-left transition-colors duration-150 ${
              isSelected
                ? 'cursor-default border-violet-accent bg-violet-accent/8'
                : isLocked
                  ? 'cursor-not-allowed border-ink-800 bg-ink-950 opacity-40'
                  : 'border-ink-700 bg-ink-900 hover:border-ink-500'
            }`}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-sm text-chalk-200">{infoLabels[key]}</span>
              {isLocked && !isSelected ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-chalk-500" aria-hidden />
              ) : null}
            </span>

            <span
              className={`tnum text-base font-light ${isSelected ? 'text-chalk-50' : 'text-chalk-500'}`}
            >
              {isSelected ? scenario.info[key] : '— — —'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Компактный показ уже открытых блоков во время торговли. */
export function InfoStrip({
  scenario,
  selected,
}: {
  scenario: BlindMarketScenario
  selected: BlindInfoKey[]
}) {
  if (!selected.length) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {selected.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3"
        >
          <span className="text-[11px] tracking-[0.12em] text-chalk-500 uppercase">
            {infoLabels[key]}
          </span>
          <span className="tnum text-sm text-chalk-50">{scenario.info[key]}</span>
        </div>
      ))}
    </div>
  )
}
