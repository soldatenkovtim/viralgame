import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  TickMarkType,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { ChartMarker } from '@/components/charts/CandleChart'
import {
  logicalToX,
  OverlayPrimitive,
  xToLogical,
  type OverlayLine,
} from '@/components/charts/overlayPrimitive'
import { formatPercent, formatPrice } from '@/lib/formatting'
import {
  aggregateCandles,
  bucketStart,
  formatClock,
  formatCalendarTime,
  formatSessionTime,
  formatVolume,
  getTimeframe,
  logicalToTime,
  sessionDay,
  timeToLogical,
  type TimeframeId,
} from '@/games/blind-market/timeframes'
import type { ChartAnnotations, ChartPoint, OhlcvCandle } from '@/types/game'

export type DrawingTool = 'none' | 'level' | 'trend' | 'stop'

export type ChartDrawEvent =
  | { type: 'level'; price: number }
  | { type: 'stop'; price: number }
  | { type: 'trend'; a: ChartPoint; b: ChartPoint }

export interface OverlaySegment {
  a: ChartPoint
  b: ChartPoint
  color: string
  dashed?: boolean
}

type HitTarget = { kind: 'stop' } | { kind: 'level'; id: string } | { kind: 'trend'; id: string }

export const CHART_COLORS = {
  up: '#16815a',
  down: '#c6384a',
  grid: '#e1e1db',
  border: '#d4d4ce',
  text: '#666661',
  level: '#8a8a99',
  selected: '#7741c8',
  trend: '#6531b2',
  stop: '#c6384a',
  entry: '#666661',
}

const VOLUME_UP = 'rgba(46, 189, 133, 0.38)'
const VOLUME_DOWN = 'rgba(240, 97, 109, 0.38)'
const RIGHT_OFFSET = 10
const HIT_RADIUS = 6

/**
 * Рабочий график трейдера: свечи, объём, зум и панорама, crosshair с OHLCV,
 * пользовательская разметка и стоп.
 *
 * В серию попадают только уже раскрытые свечи, а правый край зафиксирован:
 * проскроллить в будущее технически нечего.
 */
export function TradingChart(props: {
  candles: OhlcvCandle[]
  visibleCount: number
  timeframe: TimeframeId
  annotations: ChartAnnotations
  selectedId?: string | null
  tool?: DrawingTool
  /** `neutral` рисует вход серым: цвет не должен подсказывать, хороша ли позиция. */
  entry?: { price: number; side: 1 | -1; label?: string; neutral?: boolean } | null
  stopPrice?: number | null
  /** Сколько баров показать при первой загрузке и смене таймфрейма. */
  visibleBars?: number
  /** Подпись у метки последней цены на оси. */
  lastPriceTitle?: string
  markers?: ChartMarker[]
  segments?: OverlaySegment[]
  /** Можно ли выделять и перетаскивать уровни. */
  editable?: boolean
  /** Раскрыть календарные даты после завершения игры. */
  showDates?: boolean
  /** Приглушить свечи после полного выхода (UTC timestamp). */
  mutedAfter?: number
  /** Можно ли перетаскивать стоп. */
  stopDraggable?: boolean
  hint?: string | null
  onDraw?: (event: ChartDrawEvent) => void
  onSelect?: (id: string | null) => void
  onMoveLevel?: (id: string, price: number) => void
  onMoveStop?: (price: number) => void
  className?: string
}) {
  const {
    candles,
    visibleCount,
    timeframe,
    annotations,
    selectedId = null,
    tool = 'none',
    entry = null,
    stopPrice = null,
    markers,
    segments,
    hint,
    visibleBars,
    lastPriceTitle = '',
    mutedAfter,
    className = 'h-[480px]',
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const overlayRef = useRef<OverlayPrimitive | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const renderedRef = useRef<{ timeframe: TimeframeId; visibleCount: number; mutedAfter?: number } | null>(null)
  const anchorRef = useRef<ChartPoint | null>(null)
  const previewRef = useRef<ChartPoint | null>(null)
  const dragRef = useRef<HitTarget | null>(null)
  const propsRef = useRef(props)

  const origin = candles[0]?.time ?? 0
  const frame = getTimeframe(timeframe)
  const geometryRef = useRef({ origin, seconds: frame.seconds, bars: [] as OhlcvCandle[] })

  const bars = useMemo(
    () => aggregateCandles(candles, visibleCount, frame.seconds),
    [candles, visibleCount, frame.seconds],
  )

  const [hover, setHover] = useState<{ x: number; y: number; index: number } | null>(null)
  const [paneWidth, setPaneWidth] = useState(0)

  useLayoutEffect(() => {
    propsRef.current = props
    geometryRef.current = { origin, seconds: frame.seconds, bars }
  })

  const refreshOverlay = () => {
    const overlay = overlayRef.current
    if (!overlay) return
    const current = propsRef.current
    const lines: OverlayLine[] = []

    for (const segment of current.segments ?? []) {
      lines.push({ a: segment.a, b: segment.b, color: segment.color, width: 1.25, dashed: segment.dashed })
    }

    const trend = current.annotations.trendLine
    if (trend) {
      const selected = current.selectedId === trend.id
      lines.push({
        a: trend.a,
        b: trend.b,
        color: selected ? CHART_COLORS.selected : CHART_COLORS.trend,
        width: selected ? 2 : 1.5,
        handles: selected,
      })
    }

    if (anchorRef.current && previewRef.current) {
      lines.push({
        a: anchorRef.current,
        b: previewRef.current,
        color: CHART_COLORS.selected,
        width: 1.5,
        dashed: true,
        handles: true,
      })
    }

    overlay.setLines(lines)
  }

  /** Ближайший к курсору элемент разметки в пределах нескольких пикселей. */
  const findHit = (x: number, y: number, draggableOnly: boolean): HitTarget | null => {
    const chart = chartRef.current
    const series = candleRef.current
    if (!chart || !series) return null
    const current = propsRef.current
    let best: { target: HitTarget; distance: number } | null = null

    const consider = (target: HitTarget, distance: number) => {
      if (distance <= HIT_RADIUS && (!best || distance < best.distance)) best = { target, distance }
    }

    if (current.stopDraggable && current.stopPrice != null) {
      const stopY = series.priceToCoordinate(current.stopPrice)
      if (stopY !== null) consider({ kind: 'stop' }, Math.abs(stopY - y))
    }

    if (current.editable) {
      for (const level of current.annotations.levels) {
        const levelY = series.priceToCoordinate(level.price)
        if (levelY !== null) consider({ kind: 'level', id: level.id }, Math.abs(levelY - y))
      }

      const trend = current.annotations.trendLine
      if (trend && !draggableOnly) {
        const { origin: o, seconds } = geometryRef.current
        const timeScale = chart.timeScale()
        const x1 = logicalToX(timeScale, timeToLogical(trend.a.time, o, seconds, geometryRef.current.bars))
        const x2 = logicalToX(timeScale, timeToLogical(trend.b.time, o, seconds, geometryRef.current.bars))
        const y1 = series.priceToCoordinate(trend.a.price)
        const y2 = series.priceToCoordinate(trend.b.price)
        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
          consider({ kind: 'trend', id: trend.id }, distanceToSegment(x, y, x1, y1, x2, y2))
        }
      }
    }

    return (best as { target: HitTarget } | null)?.target ?? null
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: CHART_COLORS.text,
        fontSize: 11,
        fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.26 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: RIGHT_OFFSET,
        barSpacing: 8,
        minBarSpacing: 1.5,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const seconds = time as number
          if (type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds) {
            return formatClock(seconds)
          }
          return propsRef.current.showDates
            ? formatCalendarTime(seconds, false)
            : `День ${sessionDay(seconds, geometryRef.current.origin)}`
        },
      },
      localization: {
        locale: 'ru-RU',
        timeFormatter: (time: Time) => propsRef.current.showDates
          ? formatCalendarTime(time as number)
          : formatSessionTime(time as number, geometryRef.current.origin),
        priceFormatter: (price: number) => price.toFixed(2),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#4a4a58', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#24242c' },
        horzLine: { color: '#4a4a58', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#24242c' },
      },
      handleScroll: {
        // Consume horizontal trackpad wheels (including at chart edges) instead
        // of handing them to the browser's back/forward gesture. Lightweight
        // Charts uses a non-passive wheel listener and calls preventDefault.
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: true,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceLineVisible: true,
      priceLineStyle: LineStyle.Dotted,
      priceLineColor: '#5a5a68',
      lastValueVisible: true,
      // Линия входа всегда в кадре: без неё нельзя оценить позицию.
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original()
        const entryPrice = propsRef.current.entry?.price
        if (!info?.priceRange || entryPrice == null) return info
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, entryPrice),
            maxValue: Math.max(info.priceRange.maxValue, entryPrice),
          },
        }
      },
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, visible: false })

    const overlay = new OverlayPrimitive()
    overlay.toLogical = (time) =>
      timeToLogical(time, geometryRef.current.origin, geometryRef.current.seconds, geometryRef.current.bars)
    overlay.hitTester = (x, y) => {
      if (propsRef.current.tool !== 'none') return null
      const hit = findHit(x, y, false)
      if (!hit) return null
      return {
        externalId: hit.kind === 'stop' ? 'stop' : hit.id,
        cursorStyle: hit.kind === 'trend' ? 'pointer' : 'ns-resize',
        zOrder: 'top',
      }
    }
    candleSeries.attachPrimitive(overlay)

    chartRef.current = chart
    candleRef.current = candleSeries
    volumeRef.current = volumeSeries
    markersRef.current = createSeriesMarkers(candleSeries, [])
    overlayRef.current = overlay
    const pointAt = (x: number, y: number): ChartPoint | null => {
      const price = candleSeries.coordinateToPrice(y)
      const logical = xToLogical(chart.timeScale(), x)
      if (price === null || logical === null) return null
      const { origin: o, seconds } = geometryRef.current
      return { time: logicalToTime(logical, o, seconds, geometryRef.current.bars), price }
    }

    chart.subscribeClick((param) => {
      const current = propsRef.current
      if (!param.point) return
      const point = pointAt(param.point.x, param.point.y)
      if (!point) return

      switch (current.tool) {
        case 'level':
          current.onDraw?.({ type: 'level', price: point.price })
          return
        case 'stop':
          current.onDraw?.({ type: 'stop', price: point.price })
          return
        case 'trend':
          if (!anchorRef.current) {
            anchorRef.current = point
            previewRef.current = point
            refreshOverlay()
            return
          }
          current.onDraw?.({ type: 'trend', a: anchorRef.current, b: point })
          anchorRef.current = null
          previewRef.current = null
          refreshOverlay()
          return
        default: {
          if (!current.editable) return
          const hit = findHit(param.point.x, param.point.y, false)
          current.onSelect?.(hit && hit.kind !== 'stop' ? hit.id : null)
        }
      }
    })

    chart.subscribeCrosshairMove((param) => {
      if (anchorRef.current && param.point) {
        previewRef.current = pointAt(param.point.x, param.point.y)
        refreshOverlay()
      }

      if (!param.point || param.time === undefined) {
        setHover(null)
        return
      }
      const index = geometryRef.current.bars.findIndex(bar => bar.time === param.time)
      setHover({ x: param.point.x, y: param.point.y, index })
    })

    const handleSize = () => setPaneWidth(chart.timeScale().width())
    chart.timeScale().subscribeSizeChange(handleSize)

    // Перетаскивание стопа и уровней перехватывается до того, как график начнёт панораму.
    const handlePointerDown = (event: PointerEvent) => {
      const current = propsRef.current
      if (event.button !== 0 || current.tool !== 'none') return
      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x > chart.timeScale().width()) return

      const hit = findHit(x, y, true)
      if (!hit || hit.kind === 'trend') return

      event.preventDefault()
      event.stopPropagation()
      dragRef.current = hit
      if (hit.kind === 'level') current.onSelect?.(hit.id)
    }

    const blockWhileDragging = (event: Event) => {
      if (dragRef.current) event.stopPropagation()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = container.getBoundingClientRect()
      const price = candleSeries.coordinateToPrice(event.clientY - rect.top)
      if (price === null) return
      const current = propsRef.current
      if (drag.kind === 'stop') current.onMoveStop?.(price)
      else if (drag.kind === 'level') current.onMoveLevel?.(drag.id, price)
    }

    const handlePointerUp = () => {
      dragRef.current = null
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    container.addEventListener('mousedown', blockWhileDragging, true)
    container.addEventListener('touchstart', blockWhileDragging, true)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
      container.removeEventListener('mousedown', blockWhileDragging, true)
      container.removeEventListener('touchstart', blockWhileDragging, true)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      chart.timeScale().unsubscribeSizeChange(handleSize)
      priceLinesRef.current = []
      renderedRef.current = null
      markersRef.current = null
      overlayRef.current = null
      volumeRef.current = null
      candleRef.current = null
      chartRef.current = null
      chart.remove()
    }
    // График создаётся один раз; актуальные пропсы читаются через propsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Данные: при смене таймфрейма — полная перезагрузка, при раскрытии — дозапись.
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleRef.current
    const volumeSeries = volumeRef.current
    if (!chart || !candleSeries || !volumeSeries) return

    const toCandle = (bar: OhlcvCandle) => ({
      time: bar.time as UTCTimestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      ...(mutedAfter !== undefined && bar.time > mutedAfter
        ? { color: '#666674', borderColor: '#666674', wickColor: '#666674' }
        : {}),
    })
    const toVolume = (bar: OhlcvCandle) => ({
      time: bar.time as UTCTimestamp,
      value: bar.volume,
      color: mutedAfter !== undefined && bar.time > mutedAfter
        ? 'rgba(107, 107, 120, 0.3)'
        : bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
    })

    const rendered = renderedRef.current
    const canAppend =
      rendered !== null && rendered.mutedAfter === mutedAfter && rendered.timeframe === timeframe && visibleCount >= rendered.visibleCount

    if (!canAppend) {
      candleSeries.setData(bars.map(toCandle))
      volumeSeries.setData(bars.map(toVolume))
      const count = bars.length
      const shown = Math.min(count, visibleBars ?? frame.defaultBars)
      chart.timeScale().setVisibleLogicalRange({
        from: count - shown - 0.5,
        to: count - 1 + RIGHT_OFFSET,
      })
    } else {
      const renderedBars = aggregateCandles(candles, rendered.visibleCount, frame.seconds).length
      for (let i = Math.max(0, renderedBars - 1); i < bars.length; i += 1) {
        candleSeries.update(toCandle(bars[i]))
        volumeSeries.update(toVolume(bars[i]))
      }
    }

    renderedRef.current = { timeframe, visibleCount, mutedAfter }
    refreshOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, timeframe, mutedAfter])

  // Уровни, вход и стоп — нативные price lines с метками на ценовой оси.
  useEffect(() => {
    const series = candleRef.current
    if (!series) return

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    const lines: IPriceLine[] = []

    annotations.levels.forEach((level) => {
      const selected = level.id === selectedId
      lines.push(
        series.createPriceLine({
          price: level.price,
          color: selected ? CHART_COLORS.selected : CHART_COLORS.level,
          lineWidth: selected ? 2 : 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: '',
        }),
      )
    })

    if (entry) {
      lines.push(
        series.createPriceLine({
          price: entry.price,
          color: entry.neutral
            ? CHART_COLORS.entry
            : entry.side > 0
              ? CHART_COLORS.up
              : CHART_COLORS.down,
          lineWidth: 1,
          lineStyle: entry.neutral ? LineStyle.LargeDashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: entry.label ?? 'Вход',
        }),
      )
    }

    if (stopPrice != null) {
      lines.push(
        series.createPriceLine({
          price: stopPrice,
          color: CHART_COLORS.stop,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Стоп',
        }),
      )
    }

    priceLinesRef.current = lines
  }, [annotations.levels, selectedId, entry, stopPrice])

  useEffect(() => {
    candleRef.current?.applyOptions({ title: lastPriceTitle })
  }, [lastPriceTitle])

  useEffect(() => {
    refreshOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations.trendLine, selectedId, segments])

  useEffect(() => {
    if (tool !== 'trend') {
      anchorRef.current = null
      previewRef.current = null
      refreshOverlay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  useEffect(() => {
    const plugin = markersRef.current
    if (!plugin) return

    const mapped: SeriesMarker<Time>[] = (markers ?? [])
      .filter((marker) => Number.isInteger(marker.candleIndex) && marker.candleIndex >= 0 && marker.candleIndex < Math.min(visibleCount, candles.length))
      .map((marker) => ({
        time: bucketStart(candles[marker.candleIndex].time, origin, frame.seconds) as Time,
        position: marker.position,
        shape: marker.shape,
        color: marker.color,
        text: marker.text,
        size: 1,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))

    plugin.setMarkers(mapped)
  }, [markers, candles, visibleCount, origin, frame.seconds])

  const hovered = hover ? bars[hover.index] : undefined
  const previous = hover && hover.index > 0 ? bars[hover.index - 1] : undefined

  return (
    <div data-trading-chart className={`relative w-full ${className}`}>
      <div
        ref={containerRef}
        className={`absolute inset-0 ${tool !== 'none' ? 'cursor-crosshair' : ''}`}
      />

      {hint ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-violet-accent/40 bg-ink-950/90 px-3 py-1.5 text-xs whitespace-nowrap text-chalk-200">
          {hint}
        </div>
      ) : null}

      {hover && hovered && tool === 'none' ? (
        <OhlcvTooltip
          bar={hovered}
          previousClose={previous?.close}
          origin={origin}
          showDates={props.showDates}
          x={hover.x}
          y={hover.y}
          paneWidth={paneWidth}
        />
      ) : null}
    </div>
  )
}

function OhlcvTooltip({
  bar,
  previousClose,
  origin,
  showDates,
  x,
  y,
  paneWidth,
}: {
  bar: OhlcvCandle
  previousClose?: number
  origin: number
  showDates?: boolean
  x: number
  y: number
  paneWidth: number
}) {
  const width = 168
  const left = x + 16 + width > paneWidth ? x - width - 16 : x + 16
  const top = Math.max(8, y - 120)
  const change = previousClose ? ((bar.close - previousClose) / previousClose) * 100 : null
  const tone = bar.close >= bar.open ? 'text-market-up' : 'text-market-down'

  const rows: [string, string][] = [
    ['Откр.', formatPrice(bar.open)],
    ['Макс.', formatPrice(bar.high)],
    ['Мин.', formatPrice(bar.low)],
    ['Закр.', formatPrice(bar.close)],
    ['Объём', formatVolume(bar.volume)],
  ]

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col gap-1.5 rounded-lg border border-ink-600 bg-ink-950/95 px-3 py-2.5 text-xs shadow-lg"
      style={{ left, top, width }}
    >
      <span className="text-chalk-400">{showDates ? formatCalendarTime(bar.time) : formatSessionTime(bar.time, origin)}</span>
      <div className="tnum grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="text-chalk-500">{label}</span>
            <span className={`text-right ${label === 'Закр.' ? tone : 'text-chalk-50'}`}>
              {value}
            </span>
          </div>
        ))}
        {change !== null ? (
          <>
            <span className="text-chalk-500">Изм.</span>
            <span className={`text-right ${change >= 0 ? 'text-market-up' : 'text-market-down'}`}>
              {formatPercent(change, 2)}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
