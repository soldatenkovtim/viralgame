import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Eraser, Minus, X } from 'lucide-react'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { TradingChart, type ChartDrawEvent, type DrawingTool } from '@/components/charts/TradingChart'
import { TimeframeSwitch, ToolButton } from '@/games/blind-market/ChartToolbar'
import type { TimeframeId } from '@/games/blind-market/timeframes'
import type { ChartAnnotations, MarketShockScenario, UserPriceLevel } from '@/types/game'
import { MAX_LEVELS, positionLabel } from './engine'
import { SHOCK_VISIBLE_BARS } from './scenarios'

let levelSeq = 0

/**
 * Рабочий график сценария: свечи и объём, два таймфрейма, линия входа
 * и до двух собственных уровней. Будущие свечи в серию не попадают.
 */
export function MarketShockChart({
  scenario,
  visibleCount,
  position,
  levels,
  onLevelsChange,
  markers,
  editable = true,
  toolbarExtra,
  className = 'h-[clamp(420px,calc(100vh-260px),720px)]',
}: {
  scenario: MarketShockScenario
  visibleCount: number
  /** Текущая позиция со знаком — только для подписи линии входа. */
  position: number
  levels: UserPriceLevel[]
  onLevelsChange?: (levels: UserPriceLevel[]) => void
  markers?: ChartMarker[]
  editable?: boolean
  toolbarExtra?: ReactNode
  className?: string
}) {
  const [timeframe, setTimeframe] = useState<TimeframeId>(scenario.primaryTimeframe)
  const [tool, setTool] = useState<DrawingTool>('none')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setTimeframe(scenario.primaryTimeframe)
    setTool('none')
    setSelectedId(null)
  }, [scenario])

  const annotations = useMemo<ChartAnnotations>(() => ({ levels, trendLine: null }), [levels])
  const { direction, entryPrice } = scenario.initialPosition
  const entry = useMemo(
    () => ({
      price: entryPrice,
      side: (direction === 'long' ? 1 : -1) as 1 | -1,
      label: position === 0 ? 'ENTRY' : `ENTRY · ${positionLabel(position)}`,
      neutral: true,
    }),
    [direction, entryPrice, position],
  )

  const levelsFull = levels.length >= MAX_LEVELS

  const deleteSelected = () => {
    if (!selectedId) return
    onLevelsChange?.(levels.filter((level) => level.id !== selectedId))
    setSelectedId(null)
  }

  useEffect(() => {
    if (!editable) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'Escape') setTool('none')
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        onLevelsChange?.(levels.filter((level) => level.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editable, levels, onLevelsChange, selectedId])

  const handleDraw = (event: ChartDrawEvent) => {
    if (event.type !== 'level' || levelsFull) return
    levelSeq += 1
    const level = { id: `level-${levelSeq}`, price: Math.round(event.price * 100) / 100 }
    onLevelsChange?.([...levels, level])
    setSelectedId(level.id)
    setTool('none')
  }

  const moveLevel = (id: string, price: number) => {
    onLevelsChange?.(
      levels.map((level) =>
        level.id === id ? { ...level, price: Math.round(price * 100) / 100 } : level,
      ),
    )
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-3 py-2">
        <div className="flex items-center gap-3">
          <TimeframeSwitch
            value={timeframe}
            onChange={setTimeframe}
            options={[scenario.primaryTimeframe, scenario.contextTimeframe]}
          />
          {toolbarExtra}
        </div>

        {editable ? (
          <div className="flex items-center gap-1" role="toolbar" aria-label="Уровни">
            <ToolButton
              active={tool === 'level'}
              disabled={levelsFull}
              title={
                levelsFull
                  ? `Максимум ${MAX_LEVELS} уровня — удали лишний`
                  : 'Горизонтальный уровень: клик по графику'
              }
              onClick={() => setTool(tool === 'level' ? 'none' : 'level')}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
              Уровень
              <span className="tnum text-chalk-500">
                {levels.length}/{MAX_LEVELS}
              </span>
            </ToolButton>
            <ToolButton disabled={!selectedId} title="Удалить выбранный уровень (Delete)" onClick={deleteSelected}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Удалить
            </ToolButton>
            <ToolButton
              disabled={levels.length === 0}
              title="Удалить все уровни"
              onClick={() => {
                onLevelsChange?.([])
                setSelectedId(null)
              }}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Очистить все</span>
            </ToolButton>
          </div>
        ) : null}
      </div>

      <TradingChart
        className={className}
        candles={scenario.candles}
        visibleCount={visibleCount}
        timeframe={timeframe}
        visibleBars={timeframe === scenario.primaryTimeframe ? SHOCK_VISIBLE_BARS : undefined}
        annotations={annotations}
        selectedId={selectedId}
        tool={tool}
        entry={entry}
        lastPriceTitle="CURRENT"
        markers={markers}
        editable={editable}
        hint={tool === 'level' ? 'Кликни по графику, чтобы поставить уровень' : null}
        onDraw={handleDraw}
        onSelect={setSelectedId}
        onMoveLevel={moveLevel}
      />
    </div>
  )
}
