import type { ReactNode } from 'react'

/**
 * Крупная кнопка выбора для игровых решений.
 * Сложность должна быть в решении, а не в интерфейсе, поэтому вариантов мало
 * и каждый занимает много места.
 */
export function ChoiceButton({
  label,
  hint,
  selected = false,
  disabled = false,
  tone = 'neutral',
  compact = false,
  onClick,
}: {
  label: string
  hint?: string
  selected?: boolean
  disabled?: boolean
  tone?: 'neutral' | 'up' | 'down'
  compact?: boolean
  onClick?: () => void
}) {
  const toneRing =
    tone === 'up'
      ? 'hover:border-market-up/60'
      : tone === 'down'
        ? 'hover:border-market-down/60'
        : 'hover:border-violet-accent/60'

  const selectedRing =
    tone === 'up'
      ? 'border-market-up bg-market-up/8'
      : tone === 'down'
        ? 'border-market-down bg-market-down/8'
        : 'border-violet-accent bg-violet-accent/10'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-start justify-center gap-1 border text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
        compact ? 'min-h-12 rounded-lg px-4 py-2.5' : 'min-h-16 rounded-xl px-5 py-4'
      } ${selected ? selectedRing : `border-ink-700 bg-ink-900 ${toneRing}`}`}
    >
      <span
        className={`font-medium tracking-tight text-chalk-50 ${compact ? 'text-sm' : 'text-base'}`}
      >
        {label}
      </span>
      {hint ? <span className="text-xs text-chalk-500">{hint}</span> : null}
    </button>
  )
}

export function PillButton({
  children,
  selected = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`tnum min-h-11 rounded-lg border px-5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
        selected
          ? 'border-violet-accent bg-violet-accent/12 text-chalk-50'
          : 'border-ink-700 bg-ink-900 text-chalk-200 hover:border-ink-500'
      }`}
    >
      {children}
    </button>
  )
}
