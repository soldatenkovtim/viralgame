import { describe, expect, it } from 'vitest'
import { PERIOD, outcomeRoutes, pointOn, routeAt, sequenceAt } from './marketSimulationMotion'

describe('market simulation choreography', () => {
  it('collects signals before lighting the decision and sending the outcome', () => {
    const incoming = sequenceAt(800)
    expect(incoming.incoming.every(value => value > 0 && value < 1)).toBe(true)
    expect(incoming.node).toBe(0)
    expect(incoming.route).toBe(0)
    const decision = sequenceAt(1700)
    expect(decision.incoming).toEqual([1, 1, 1])
    expect(decision.node).toBeGreaterThan(.9)
    expect(decision.outgoing).toBe(0)
    const outcome = sequenceAt(2800)
    expect(outcome.route).toBe(1)
    expect(outcome.outgoing).toBeGreaterThan(0)
    expect(outcome.outgoing).toBeLessThan(1)
  })

  it('visits each outcome once and fades before every handoff', () => {
    for (let branch = 0; branch < 3; branch++) {
      expect(sequenceAt(branch * 4000 + 2800).branch).toBe(branch)
      expect(sequenceAt(branch * 4000 + 3999).route).toBeLessThan(.001)
      expect(sequenceAt(branch * 4000).route).toBe(0)
    }
    expect(sequenceAt(PERIOD)).toEqual(sequenceAt(0))
    expect(outcomeRoutes(PERIOD)).toEqual(outcomeRoutes(0))
  })

  it('targets each visible route across the animation, ignoring empty space and the shared node', () => {
    for (const time of [0, 2400, 6200, 10000]) {
      outcomeRoutes(time).forEach((route, branch) => {
        expect(routeAt(pointOn(route, .65), time)).toBe(branch)
        expect(routeAt(route[3], time)).toBe(branch)
      })
      expect(routeAt([234, 272], time)).toBeNull()
      expect(routeAt([500, 60], time)).toBeNull()
      expect(routeAt([610, 272], time)).toBeNull()
    }
  })
})
