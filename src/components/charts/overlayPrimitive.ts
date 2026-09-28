import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { ChartPoint } from '@/types/game'

export interface OverlayLine {
  a: ChartPoint
  b: ChartPoint
  color: string
  width: number
  dashed?: boolean
  /** Кружки на концах — для выбранной трендовой линии и точек replay. */
  handles?: boolean
}

type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]
type TimeScaleApi = ReturnType<IChartApiBase<Time>['timeScale']>

/** Библиотека переводит в координаты только целые индексы — дробные интерполируем сами. */
export function logicalToX(timeScale: TimeScaleApi, logical: number): number | null {
  const index = Math.floor(logical)
  const x0 = timeScale.logicalToCoordinate(index as Logical)
  const x1 = timeScale.logicalToCoordinate((index + 1) as Logical)
  if (x0 === null || x1 === null) return null
  return x0 + (logical - index) * (x1 - x0)
}

export function xToLogical(timeScale: TimeScaleApi, x: number): number | null {
  const index = timeScale.coordinateToLogical(x)
  if (index === null) return null
  const x0 = timeScale.logicalToCoordinate(index)
  const x1 = timeScale.logicalToCoordinate((index + 1) as Logical)
  if (x0 === null || x1 === null || x1 === x0) return index
  return index + (x - x0) / (x1 - x0)
}

/**
 * Рисует произвольные отрезки поверх свечей: трендовую линию, её превью
 * при построении и линии входа/стопа в итоговом replay.
 * Координаты пересчитываются в каждом кадре, поэтому линии корректно
 * следуют за зумом, панорамой и сменой таймфрейма.
 */
export class OverlayPrimitive implements ISeriesPrimitive<Time> {
  private lines: OverlayLine[] = []
  private chart: IChartApiBase<Time> | null = null
  private series: ISeriesApi<SeriesType, Time> | null = null
  private requestUpdate: (() => void) | null = null
  private readonly views: IPrimitivePaneView[]

  toLogical: (time: number) => number = () => 0
  hitTester: ((x: number, y: number) => PrimitiveHoveredItem | null) | null = null

  constructor() {
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) }
    this.views = [{ renderer: () => renderer, zOrder: () => 'top' }]
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached() {
    this.chart = null
    this.series = null
    this.requestUpdate = null
  }

  paneViews() {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    return this.hitTester?.(x, y) ?? null
  }

  setLines(lines: OverlayLine[]) {
    this.lines = lines
    this.requestUpdate?.()
  }

  private draw(target: DrawTarget) {
    const chart = this.chart
    const series = this.series
    if (!chart || !series || !this.lines.length) return
    const timeScale = chart.timeScale()

    target.useMediaCoordinateSpace(({ context }) => {
      for (const line of this.lines) {
        const x1 = logicalToX(timeScale, this.toLogical(line.a.time))
        const x2 = logicalToX(timeScale, this.toLogical(line.b.time))
        const y1 = series.priceToCoordinate(line.a.price)
        const y2 = series.priceToCoordinate(line.b.price)
        if (x1 === null || x2 === null || y1 === null || y2 === null) continue

        context.save()
        context.strokeStyle = line.color
        context.lineWidth = line.width
        context.setLineDash(line.dashed ? [5, 4] : [])
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()

        if (line.handles) {
          context.setLineDash([])
          context.fillStyle = '#0c0c0f'
          for (const [x, y] of [
            [x1, y1],
            [x2, y2],
          ]) {
            context.beginPath()
            context.arc(x, y, 3.5, 0, Math.PI * 2)
            context.fill()
            context.stroke()
          }
        }
        context.restore()
      }
    })
  }
}
