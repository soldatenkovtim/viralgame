import type { ReactNode } from 'react'
import { Eraser, Minus, Slash, Trash2 } from 'lucide-react'
import type { DrawingTool } from '@/components/charts/TradingChart'
import { TIMEFRAMES, type TimeframeId } from './timeframes'

export const MAX_LEVELS = 3
export const MAX_TREND_LINES = 1

export function TimeframeSwitch({
  value,
  onChange,
  options,
}: {
  value: TimeframeId
  onChange: (value: TimeframeId) => void
  /** Ограничивает набор таймфреймов; по умолчанию — все. */
  options?: TimeframeId[]
}) {
  const frames = options
    ? TIMEFRAMES.filter((timeframe) => options.includes(timeframe.id))
    : TIMEFRAMES

  return (
    <div
      role="radiogroup"
      aria-label="Таймфрейм"
      className="flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-950 p-0.5"
    >
      {frames.map((timeframe) => {
        const active = timeframe.id === value
        return (
          <button
            key={timeframe.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(timeframe.id)}
            className={`tnum min-w-10 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              active ? 'bg-ink-700 text-chalk-50' : 'text-chalk-500 hover:text-chalk-200'
            }`}
          >
            {timeframe.label}
          </button>
        )
      })}
    </div>
  )
}

export function DrawingToolbar({
  tool,
  levelCount,
  hasTrendLine,
  hasSelection,
  hasDrawings,
  onTool,
  onDeleteSelected,
  onClear,
}: {
  tool: DrawingTool
  levelCount: number
  hasTrendLine: boolean
  hasSelection: boolean
  hasDrawings: boolean
  onTool: (tool: DrawingTool) => void
  onDeleteSelected: () => void
  onClear: () => void
}) {
  const levelsFull = levelCount >= MAX_LEVELS
  const trendFull = hasTrendLine

  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Разметка графика">
      <ToolButton
        active={tool === 'level'}
        disabled={levelsFull}
        title={
          levelsFull
            ? `Максимум ${MAX_LEVELS} уровня — удали лишний`
            : 'Горизонтальный уровень: клик по графику'
        }
        onClick={() => onTool(tool === 'level' ? 'none' : 'level')}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden xl:inline">Уровень</span>
        <span className="tnum text-chalk-500">
          {levelCount}/{MAX_LEVELS}
        </span>
      </ToolButton>

      <ToolButton
        active={tool === 'trend'}
        disabled={trendFull}
        title={trendFull ? 'Трендовая линия уже есть — удали её, чтобы нарисовать новую' : 'Трендовая линия: два клика по графику'}
        onClick={() => onTool(tool === 'trend' ? 'none' : 'trend')}
      >
        <Slash className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden xl:inline">Тренд</span>
        <span className="tnum text-chalk-500">
          {hasTrendLine ? 1 : 0}/{MAX_TREND_LINES}
        </span>
      </ToolButton>

      <span className="mx-1 h-5 w-px bg-ink-700" aria-hidden />

      <ToolButton
        disabled={!hasSelection}
        title="Удалить выбранное (Delete)"
        onClick={onDeleteSelected}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Удалить выбранное</span>
      </ToolButton>

      <ToolButton disabled={!hasDrawings} title="Очистить разметку" onClick={onClear}>
        <Eraser className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Очистить разметку</span>
      </ToolButton>
    </div>
  )
}

export function ToolButton({
  children,
  active = false,
  disabled = false,
  title,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-violet-accent bg-violet-accent/12 text-chalk-50'
          : 'border-ink-700 bg-ink-950 text-chalk-200 hover:border-ink-500'
      }`}
    >
      {children}
    </button>
  )
}
