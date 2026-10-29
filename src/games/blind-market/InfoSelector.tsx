import { useId } from 'react'
import { Lock } from 'lucide-react'
import type { BlindInfoKey, BlindMarketScenario } from '@/types/game'

/** Объём не выбирается отдельно: он всегда виден гистограммой под свечами. */
export const INFO_KEYS: Exclude<BlindInfoKey, 'volume'>[] = [
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

const infoDescriptions: Record<Exclude<BlindInfoKey, 'volume'>, string> = {
  volatility: 'Характер и интенсивность изменения цены.',
  correlation: 'Связь движения актива с общим рынком.',
  marketContext: 'Движение рынка и актива в доступной истории.',
  sector: 'Отрасль или область деятельности актива.',
}

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
  const id = useId()
  const full = selected.length >= MAX_INFO_SLOTS

  return (
    <div className="blind-info-grid">
      {INFO_KEYS.map((key, index) => {
        const isSelected = selected.includes(key)
        const isLocked = isSelected || full

        return (
          <button
            key={key}
            type="button"
            aria-label={isSelected ? `${infoLabels[key]} — раскрыто` : infoLabels[key]}
            aria-describedby={`${id}-${key}`}
            data-revealed={isSelected}
            disabled={isLocked}
            onClick={() => onSelect(key)}
            className="blind-info-card"
          >
            <span className="blind-info-card-header">
              <span className="blind-info-card-title">
                <span className="blind-info-card-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="blind-info-card-name">{infoLabels[key]}</span>
              </span>
              {isSelected
                ? <span className="blind-info-revealed" aria-hidden="true">Раскрыто</span>
                : <span className={`blind-info-indicator${full ? ' blind-info-indicator-locked' : ''}`} aria-hidden="true">
                    {full && <Lock size={16} />}
                  </span>}
            </span>
            <span id={`${id}-${key}`} className="blind-info-card-description">
              {isSelected ? scenario.info[key] : infoDescriptions[key]}
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
    <div className="flex flex-wrap gap-2">
      {selected.map((key) => (
        <div
          key={key}
          className="flex items-baseline gap-2 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5"
        >
          <span className="text-[11px] tracking-[0.1em] text-chalk-500 uppercase">
            {infoLabels[key]}
          </span>
          <span className="tnum text-xs text-chalk-200">{scenario.info[key]}</span>
        </div>
      ))}
    </div>
  )
}
