import { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { MMTrade } from '@/types/game'

/**
 * График котировок маркет-мейкера.
 *
 * Показывает только то, что игрок реально видит: свои bid и ask и принты
 * прошедших сделок. Истинная справедливая цена остаётся скрытой.
 */
export function QuoteChart({
  quotes,
  trades,
  height = 260,
}: {
  quotes: { tick: number; bid: number; ask: number }[]
  trades: MMTrade[]
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const bidRef = useRef<ISeriesApi<'Line'> | null>(null)
  const askRef = useRef<ISeriesApi<'Line'> | null>(null)
  const buyMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const sellMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b6b78',
        fontSize: 11,
        fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#141419' },
        horzLines: { color: '#141419' },
      },
      rightPriceScale: {
        borderColor: '#1d1d24',
        scaleMargins: { top: 0.18, bottom: 0.18 },
      },
      timeScale: { visible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: CrosshairMode.Hidden },
      handleScroll: false,
      handleScale: false,
    })

    const ask = chart.addSeries(LineSeries, {
      color: '#f0616d',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    const bid = chart.addSeries(LineSeries, {
      color: '#2ebd85',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    chartRef.current = chart
    askRef.current = ask
    bidRef.current = bid
    buyMarkersRef.current = createSeriesMarkers(ask, [])
    sellMarkersRef.current = createSeriesMarkers(bid, [])

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) chart.applyOptions({ width })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      buyMarkersRef.current = null
      sellMarkersRef.current = null
      askRef.current = null
      bidRef.current = null
      chartRef.current = null
      chart.remove()
    }
  }, [height])

  useEffect(() => {
    const bid = bidRef.current
    const ask = askRef.current
    const chart = chartRef.current
    if (!bid || !ask || !chart || quotes.length === 0) return

    const bidData: LineData<Time>[] = quotes.map((quote) => ({
      time: (quote.tick + 1) as Time,
      value: quote.bid,
    }))
    const askData: LineData<Time>[] = quotes.map((quote) => ({
      time: (quote.tick + 1) as Time,
      value: quote.ask,
    }))

    bid.setData(bidData)
    ask.setData(askData)
    chart.timeScale().fitContent()
  }, [quotes])

  useEffect(() => {
    const buyPlugin = buyMarkersRef.current
    const sellPlugin = sellMarkersRef.current
    if (!buyPlugin || !sellPlugin) return

    const botBuys: SeriesMarker<Time>[] = []
    const botSells: SeriesMarker<Time>[] = []

    for (const trade of trades) {
      const marker: SeriesMarker<Time> = {
        time: (trade.tick + 1) as Time,
        position: trade.botSide === 'buy' ? 'aboveBar' : 'belowBar',
        shape: trade.botSide === 'buy' ? 'arrowDown' : 'arrowUp',
        color: trade.botSide === 'buy' ? '#f0616d' : '#2ebd85',
        text: String(trade.size),
        size: 1,
      }
      if (trade.botSide === 'buy') botBuys.push(marker)
      else botSells.push(marker)
    }

    buyPlugin.setMarkers(botBuys)
    sellPlugin.setMarkers(botSells)
  }, [trades])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
