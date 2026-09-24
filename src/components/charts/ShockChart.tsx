import { useMemo } from 'react'

export interface ShockMarker {
  pointIndex: number
  label: string
}

/**
 * Лёгкий SVG-график для «Рыночного шока».
 *
 * Здесь не нужен интерактив свечного графика — нужна выразительная линия,
 * которая достраивается после каждого решения.
 */
export function ShockChart({
  points,
  visibleCount,
  markers = [],
  height = 300,
}: {
  points: number[]
  visibleCount: number
  markers?: ShockMarker[]
  height?: number
}) {
  const visible = points.slice(0, Math.max(2, visibleCount))

  const { path, areaPath, coords, min, max } = useMemo(() => {
    // Диапазон считаем по всему сценарию, чтобы линия не «дышала» при достройке.
    const lo = Math.min(...points)
    const hi = Math.max(...points)
    const padding = (hi - lo) * 0.12 || 1
    const low = lo - padding
    const high = hi + padding

    const width = 1000
    const usableHeight = 300

    const toPoint = (value: number, index: number) => ({
      x: (index / Math.max(1, points.length - 1)) * width,
      y: usableHeight - ((value - low) / (high - low)) * usableHeight,
    })

    const mapped = visible.map(toPoint)
    const line = mapped
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ')

    const last = mapped[mapped.length - 1]
    const area = `${line} L${last.x.toFixed(2)},${usableHeight} L0,${usableHeight} Z`

    return { path: line, areaPath: area, coords: mapped, min: low, max: high }
  }, [points, visible])

  const first = visible[0]
  const last = visible[visible.length - 1]
  const rising = last >= first

  const stroke = rising ? 'var(--color-market-up)' : 'var(--color-market-down)'

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="График рыночного движения"
      >
        <defs>
          <linearGradient id="shock-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2="1000"
            y1={300 * ratio}
            y2={300 * ratio}
            stroke="#141419"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill="url(#shock-fill)" />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {markers
          .filter((marker) => marker.pointIndex < coords.length)
          .map((marker) => {
            const point = coords[marker.pointIndex]
            return (
              <g key={`${marker.pointIndex}-${marker.label}`}>
                <line
                  x1={point.x}
                  x2={point.x}
                  y1="0"
                  y2="300"
                  stroke="#3a3a46"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="var(--color-ink-950)"
                  stroke="var(--color-violet-accent)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {markers
          .filter((marker) => marker.pointIndex < coords.length)
          .map((marker) => (
            <span
              key={`label-${marker.pointIndex}-${marker.label}`}
              className="absolute -translate-x-1/2 rounded border border-ink-700 bg-ink-900 px-2 py-0.5 text-[10px] whitespace-nowrap text-chalk-400"
              style={{
                left: `${(coords[marker.pointIndex].x / 1000) * 100}%`,
                top: 8,
              }}
            >
              {marker.label}
            </span>
          ))}
      </div>

      <div className="tnum pointer-events-none absolute top-1 right-1 text-[10px] text-chalk-500">
        {max.toFixed(1)}
      </div>
      <div className="tnum pointer-events-none absolute right-1 bottom-1 text-[10px] text-chalk-500">
        {min.toFixed(1)}
      </div>
    </div>
  )
}
