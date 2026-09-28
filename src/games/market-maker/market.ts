import { MM_TICK_MS } from '@/data/marketMakerScenarios'
import { createRandom } from '@/lib/random'
import type {
  FairValueRegime,
  FlowRegime,
  MarketMakerScenario,
  MMFairValuePhase,
  MMFlowPhase,
} from '@/types/game'

/** Дрейф и шум справедливой цены за один тик для каждого режима. */
const FAIR_VALUE_DYNAMICS: Record<FairValueRegime, { drift: number; noise: number }> = {
  calm: { drift: 0, noise: 0.018 },
  'drift-up': { drift: 0.027, noise: 0.024 },
  'drift-down': { drift: -0.027, noise: 0.024 },
  volatile: { drift: 0, noise: 0.06 },
}

/** Насколько быстро рыночная цена подтягивается к справедливой (0–1 за тик). */
const MARKET_CATCH_UP = 0.3
const MARKET_NOISE = 0.022

export interface MarketPaths {
  fairValue: number[]
  marketPrice: number[]
}

export function ticksFor(seconds: number): number {
  return Math.round((seconds * 1000) / MM_TICK_MS)
}

export function tickToSeconds(tick: number): number {
  return (tick * MM_TICK_MS) / 1000
}

export function phaseAt<T extends MMFlowPhase | MMFairValuePhase>(
  phases: T[],
  tick: number,
): T {
  const second = tickToSeconds(tick)
  return phases.find((phase) => second >= phase.from && second < phase.to) ?? phases[phases.length - 1]
}

export function flowRegimeAt(scenario: MarketMakerScenario, tick: number): FlowRegime {
  return phaseAt(scenario.flowPhases, tick).regime
}

/**
 * Скрытая справедливая цена и наблюдаемая рыночная цена на весь раунд.
 *
 * Оба пути зависят только от seed, поэтому действия игрока их не меняют,
 * а информированный поток может «смотреть в будущее» справедливой цены.
 * Рыночная цена догоняет справедливую с задержкой и шумом.
 */
export function buildMarketPaths(scenario: MarketMakerScenario, length: number): MarketPaths {
  const fvRandom = createRandom(scenario.seed)
  const marketRandom = createRandom(scenario.seed ^ 0x2c1b3c6d)

  const fairValue: number[] = [scenario.initialFairValue]
  const marketPrice: number[] = [scenario.initialFairValue]
  let drift = 0

  for (let tick = 1; tick < length; tick += 1) {
    const phase = phaseAt(scenario.fairValuePhases, tick)
    const strength = phase.strength ?? 1
    const dynamics = FAIR_VALUE_DYNAMICS[phase.regime]
    const targetDrift = dynamics.drift * strength
    const noise = dynamics.noise * Math.sqrt(strength)
    // Дрейф меняется плавно, чтобы смена режима не читалась по одному тику.
    drift += (targetDrift - drift) * 0.18
    const next = fairValue[tick - 1] + drift + fvRandom.normal(0, noise)
    fairValue.push(round2(next))

    const previousMarket = marketPrice[tick - 1]
    const market =
      previousMarket +
      (next - previousMarket) * MARKET_CATCH_UP +
      marketRandom.normal(0, MARKET_NOISE)
    marketPrice.push(round2(market))
  }

  return { fairValue, marketPrice }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
