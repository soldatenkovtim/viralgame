import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts'
import type { Candle } from '@/types/game'

export interface ChartMarker {
  candleIndex: number
  position: 'aboveBar' | 'belowBar'
  shape: 'circle' | 'arrowUp' | 'arrowDown' | 'square'
  color: string
  text: string
}

const CHART_COLORS = {
  up: '#16815a',
  down: '#c6384a',
  grid: '#e1e1db',
  border: '#d4d4ce',
  text: '#666661',
}

/**
 * Свечной график с постепенным раскрытием.
 *
 * Нераскрытые свечи передаются как whitespace-точки: это резервирует место
 * на оси времени, поэтому при открытии нового сегмента график не прыгает.
 */
export function CandleChart({
  candles,
  visibleCount,
  markers = [],
  height = 380,
}: {
  candles: Candle[]
  visibleCount: number
  markers?: ChartMarker[]
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: false,
      width: container.clientWidth,
      height,
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
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#8c8c85', width: 1, style: 3, labelBackgroundColor: '#50504f' },
        horzLine: { color: '#8c8c85', width: 1, style: 3, labelBackgroundColor: '#50504f' },
      },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) chart.applyOptions({ width })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      markersRef.current = null
      seriesRef.current = null
      chartRef.current = null
      chart.remove()
    }
  }, [height])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    const data: (CandlestickData<Time> | WhitespaceData<Time>)[] = candles.map(
      (candle, index) => {
        const time = candle.time as Time
        if (index >= visibleCount) return { time }
        return {
          time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }
      },
    )

    series.setData(data)
    chart.timeScale().fitContent()
  }, [candles, visibleCount])

  useEffect(() => {
    const plugin = markersRef.current
    if (!plugin) return

    const mapped: SeriesMarker<Time>[] = markers
      .filter((marker) => marker.candleIndex < candles.length)
      .map((marker) => ({
        time: candles[marker.candleIndex].time as Time,
        position: marker.position,
        shape: marker.shape,
        color: marker.color,
        text: marker.text,
        size: 1,
      }))

    plugin.setMarkers(mapped)
  }, [markers, candles])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
