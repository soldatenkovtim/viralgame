import { useTheme } from '@/lib/theme'
import { CHART_COLORS, applyChartTheme } from './chartTheme'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type SeriesMarker,
  type SingleValueData,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts'
import { MM_TICK_MS } from '@/data/marketMakerScenarios'
import type { MMTrade } from '@/types/game'

const QUOTE_COLORS = {
  get market() { return CHART_COLORS.market },
  get bid() { return CHART_COLORS.up },
  get ask() { return CHART_COLORS.down },
  get fairValue() { return CHART_COLORS.selected },
  informed: 'rgba(165, 139, 255, 0.11)',
  lag: 'rgba(232, 176, 75, 0.8)',
}

/** Котировка считается отстающей, если её середина ушла от fair value дальше этой доли полуспреда. */
const LAG_SHARE = 0.6
const LAG_MIN = 0.25

export interface QuoteChartPoint {
  tick: number
  marketPrice: number
  bid: number
  ask: number
  fairValue?: number
}

/**
 * График маркет-мейкера: рыночная цена, собственные bid/ask и сделки.
 *
 * Во время раунда справедливая цена не передаётся вовсе. В replay
 * добавляются fair value, подсветка информированного потока и полоса
 * тиков, где котировка игрока заметно отставала от fair value.
 */
export function QuoteChart({
  points,
  trades,
  totalTicks,
  height = 280,
  informedTicks,
  showTimeAxis = false,
  emphasizeQuotes = false,
}: {
  points: QuoteChartPoint[]
  trades: MMTrade[]
  totalTicks: number
  height?: number
  informedTicks?: Set<number>
  showTimeAxis?: boolean
  emphasizeQuotes?: boolean
}) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<{
    market: ISeriesApi<'Line'>
    bid: ISeriesApi<'Line'>
    ask: ISeriesApi<'Line'>
    fair: ISeriesApi<'Line'>
    informed: ISeriesApi<'Area'>
    lag: ISeriesApi<'Histogram'>
    askMarkers: ISeriesMarkersPluginApi<Time>
    bidMarkers: ISeriesMarkersPluginApi<Time>
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
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
        minimumWidth: 64,
      },
      timeScale: {
        visible: showTimeAxis,
        borderColor: CHART_COLORS.border,
        tickMarkFormatter: (time: Time) => `${formatTickSeconds(Number(time))} с`,
      },
      localization: {
        priceFormatter: (price: number) => price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        timeFormatter: (time: Time) => `${formatTickSeconds(Number(time))} с`,
      },
      crosshair: { mode: showTimeAxis ? CrosshairMode.Normal : CrosshairMode.Hidden },
      handleScroll: false,
      handleScale: false,
    })

    const bandOptions = {
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    }
    const informed = chart.addSeries(AreaSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceScaleId: 'informed',
      lineWidth: 1,
      lineColor: 'transparent',
      topColor: QUOTE_COLORS.informed,
      bottomColor: QUOTE_COLORS.informed,
      lineType: LineType.WithSteps,
      autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }),
    })
    chart.priceScale('informed').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false })
    const lag = chart.addSeries(HistogramSeries, {
      ...bandOptions,
      priceScaleId: 'lag',
      color: QUOTE_COLORS.lag,
    })
    chart.priceScale('lag').applyOptions({ scaleMargins: { top: 0.965, bottom: 0 }, visible: false })

    const line = (color: string, extra: Record<string, unknown> = {}) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        ...extra,
      })

    const fair = line(QUOTE_COLORS.fairValue, { lineWidth: 2, title: 'Fair value' })
    const market = line(QUOTE_COLORS.market, { lineWidth: 2, lineStyle: LineStyle.Dotted })
    const ask = line(QUOTE_COLORS.ask, { lineType: LineType.WithSteps, lineWidth: emphasizeQuotes ? 2 : 1 })
    const bid = line(QUOTE_COLORS.bid, { lineType: LineType.WithSteps, lineWidth: emphasizeQuotes ? 2 : 1 })

    chartRef.current = chart
    seriesRef.current = {
      market,
      bid,
      ask,
      fair,
      informed,
      lag,
      askMarkers: createSeriesMarkers(ask, [], { autoScale: !emphasizeQuotes }),
      bidMarkers: createSeriesMarkers(bid, [], { autoScale: !emphasizeQuotes }),
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) chart.applyOptions({ width, height: container.clientHeight })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      seriesRef.current = null
      chartRef.current = null
      chart.remove()
    }
  }, [height, showTimeAxis, emphasizeQuotes])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || points.length === 0) return

    const toLine = (value: (point: QuoteChartPoint) => number): LineData<Time>[] =>
      points.map((point) => ({ time: toTime(point.tick), value: value(point) }))

    series.market.setData(toLine((point) => point.marketPrice))
    series.bid.setData(toLine((point) => point.bid))
    series.ask.setData(toLine((point) => point.ask))

    const hasFair = points[0].fairValue !== undefined
    series.fair.setData(hasFair ? toLine((point) => point.fairValue ?? point.marketPrice) : [])

    const band = (
      active: (point: QuoteChartPoint) => boolean,
    ): (SingleValueData<Time> | WhitespaceData<Time>)[] =>
      points.map((point) =>
        active(point) ? { time: toTime(point.tick), value: 1 } : { time: toTime(point.tick) },
      )

    series.informed.setData(informedTicks ? band((point) => informedTicks.has(point.tick)) : [])
    series.lag.setData(
      hasFair
        ? band((point) => {
            const fair = point.fairValue ?? point.marketPrice
            const mid = (point.bid + point.ask) / 2
            return Math.abs(mid - fair) > Math.max(LAG_MIN, ((point.ask - point.bid) / 2) * LAG_SHARE)
          })
        : [],
    )

    chart.timeScale().setVisibleLogicalRange({ from: -0.5, to: totalTicks + 0.5 })
  }, [points, totalTicks, informedTicks])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    const askMarkers: SeriesMarker<Time>[] = []
    const bidMarkers: SeriesMarker<Time>[] = []

    // Keep live markers compact; replay retains every execution and its size.
    const visibleTrades = emphasizeQuotes
      ? compactTradeMarkers(trades, totalTicks, Math.max(1, (containerRef.current?.clientWidth ?? 664) - 64))
      : trades
    for (const trade of visibleTrades) {
      const atAsk = trade.botSide === 'buy'
      const marker: SeriesMarker<Time> = {
        time: toTime(trade.tick),
        position: 'atPriceMiddle',
        price: trade.price,
        shape: 'circle',
        color: atAsk ? QUOTE_COLORS.ask : QUOTE_COLORS.bid,
        size: emphasizeQuotes ? 0.65 : 0.5 + Math.min(trade.size, 5) * 0.12,
      }
      if (atAsk) askMarkers.push(marker)
      else bidMarkers.push(marker)
    }

    series.askMarkers.setMarkers(askMarkers)
    series.bidMarkers.setMarkers(bidMarkers)
  }, [trades, points, theme, emphasizeQuotes, totalTicks])

  useEffect(() => {
    if (chartRef.current) applyChartTheme(chartRef.current)
    const series = seriesRef.current
    if (!series) return
    series.market.applyOptions({ color: QUOTE_COLORS.market })
    series.bid.applyOptions({ color: QUOTE_COLORS.bid })
    series.ask.applyOptions({ color: QUOTE_COLORS.ask })
    series.fair.applyOptions({ color: QUOTE_COLORS.fairValue })
  }, [theme, height, showTimeAxis, emphasizeQuotes])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}

export function QuoteLegend({ replay = false, compact = false, showInformed = true }: { replay?: boolean; compact?: boolean; showInformed?: boolean }) {
  return (
    <div className={`mt-3 flex flex-wrap gap-y-1.5 px-1 text-chalk-500 ${compact ? 'gap-x-4 border-t border-ink-700 pt-3 text-[11px]' : 'gap-x-5 text-xs'}`}>
      {replay ? (
        <LegendItem swatch={<span className="block w-4 border-t-2 border-violet-soft" />}>
          Справедливая цена
        </LegendItem>
      ) : null}
      <LegendItem swatch={<span className="block w-4 border-t-2 border-dotted border-chalk-200" />}>
        Рыночная цена
      </LegendItem>
      <LegendItem swatch={<span className="block w-4 border-t border-market-up" />}>
        Ваш bid
      </LegendItem>
      <LegendItem swatch={<span className="block w-4 border-t border-market-down" />}>
        Ваш ask
      </LegendItem>
      <LegendItem swatch={<span className="block h-2 w-2 rounded-full bg-chalk-400" />}>
        Сделка
      </LegendItem>
      {replay ? (
        <>
          {showInformed && <LegendItem swatch={<span className="block h-3 w-4 rounded-sm bg-violet-accent/25" />}>
            Информированный поток
          </LegendItem>}
          <LegendItem swatch={<span className="block h-1 w-4 rounded-sm bg-risk" />}>
            Котировка отставала от fair value
          </LegendItem>
        </>
      ) : null}
    </div>
  )
}

function LegendItem({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden>{swatch}</span>
      {children}
    </span>
  )
}

function toTime(tick: number): Time {
  return (tick + 1) as Time
}

function formatTickSeconds(time: number): string {
  return String(Math.round(((time - 1) * MM_TICK_MS) / 1000))
}

/** At most one marker per side in each 8px time bucket, keeping the newest fill. */
export function compactTradeMarkers(trades: MMTrade[], totalTicks: number, plotWidth: number): MMTrade[] {
  const ticksPerBucket = Math.max(1, totalTicks * 8 / Math.max(1, plotWidth))
  const buckets = new Map<string, MMTrade>()
  for (const trade of trades) {
    buckets.set(`${trade.botSide}-${Math.floor(trade.tick / ticksPerBucket)}`, trade)
  }
  return [...buckets.values()].sort((a, b) => a.tick - b.tick)
}
