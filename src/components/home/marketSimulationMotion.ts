export type Point = [number, number]
export type Curve = [Point, Point, Point, Point]
export const PERIOD = 12_000
export const TAU = Math.PI * 2
export const decision: Point = [234, 272]

export function pointOn(curve: Curve, t: number): Point {
  const u = 1 - t
  return [0, 1].map(axis => u ** 3 * curve[0][axis] + 3 * u * u * t * curve[1][axis]
    + 3 * u * t * t * curve[2][axis] + t ** 3 * curve[3][axis]) as Point
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
const envelope = (t: number, start: number, peak: number, hold: number, end: number) =>
  ease((t - start) / (peak - start)) * (1 - ease((t - hold) / (end - hold)))

/** Three four-second decisions: incoming signals → node → outcome → quiet. */
export function sequenceAt(time: number) {
  const cycle = ((time % PERIOD) + PERIOD) % PERIOD / (PERIOD / 3)
  const t = cycle % 1
  return {
    branch: Math.floor(cycle),
    incoming: [0, .035, .07].map(delay => clamp((t - .04 - delay) / .3)),
    node: envelope(t, .30, .43, .51, .72),
    route: envelope(t, .43, .58, .81, 1),
    outgoing: clamp((t - .53) / .32),
  }
}

export function outcomeRoutes(time: number): Curve[] {
  const phase = time % PERIOD / PERIOD * TAU
  return [133 + Math.sin(phase) * 9, 272 + Math.sin(phase + 2) * 10, 411 + Math.sin(phase + 4) * 9]
    .map(y => [decision, [330, 272], [355, y], [563, y]])
}

/** Hit-test the painted paths, not invisible rectangular areas between them. */
export function routeAt(point: Point, time: number): number | null {
  if (point[0] < decision[0] + 32) return null
  let nearest = 12 ** 2
  let branch: number | null = null
  outcomeRoutes(time).forEach((route, index) => {
    for (let step = 0; step <= 64; step++) {
      const [x, y] = pointOn(route, step / 64)
      const distance = (x - point[0]) ** 2 + (y - point[1]) ** 2
      if (distance < nearest) { nearest = distance; branch = index }
    }
  })
  return branch
}
