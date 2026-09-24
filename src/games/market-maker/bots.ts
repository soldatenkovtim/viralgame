import type { SeededRandom } from '@/lib/random'
import type { BotType } from '@/types/game'

export interface BotOrder {
  side: 'buy' | 'sell'
  size: number
}

export interface BotContext {
  random: SeededRandom
  tick: number
  /** Полный путь справедливой цены, посчитанный заранее из seed. */
  fairValuePath: number[]
  bid: number
  ask: number
}

/** На сколько тиков вперёд смотрит информированный поток. */
const INFORMED_LOOKAHEAD = 5
/** Минимальное преимущество, ради которого информированный бот торгует. */
const INFORMED_EDGE = 0.03
/** Сколько последних тиков анализирует моментум-бот. */
const MOMENTUM_WINDOW = 4

/**
 * Решение бота на текущем тике. Модель намеренно грубая:
 * задача — дать игроку почувствовать разницу в характере потока,
 * а не воспроизвести реальный HFT.
 */
export function decideBotOrder(botType: BotType, context: BotContext): BotOrder | null {
  switch (botType) {
    case 'noise':
      return decideNoise(context)
    case 'informed':
      return decideInformed(context)
    case 'momentum':
      return decideMomentum(context)
  }
}

function decideNoise({ random }: BotContext): BotOrder | null {
  if (!random.chance(0.35)) return null
  return {
    side: random.chance(0.5) ? 'buy' : 'sell',
    size: random.int(1, 4),
  }
}

function decideInformed(context: BotContext): BotOrder | null {
  const { random, tick, fairValuePath, bid, ask } = context
  const future = fairValuePath[Math.min(tick + INFORMED_LOOKAHEAD, fairValuePath.length - 1)]

  // Покупает, когда ask заметно ниже будущей справедливой цены.
  if (future - ask > INFORMED_EDGE && random.chance(0.7)) {
    return { side: 'buy', size: random.int(2, 5) }
  }

  // Продаёт, когда bid заметно выше будущей справедливой цены.
  if (bid - future > INFORMED_EDGE && random.chance(0.7)) {
    return { side: 'sell', size: random.int(2, 5) }
  }

  // Изредка торгует «просто так», чтобы поток не читался с первой сделки.
  if (random.chance(0.08)) {
    return { side: random.chance(0.5) ? 'buy' : 'sell', size: random.int(1, 2) }
  }

  return null
}

function decideMomentum(context: BotContext): BotOrder | null {
  const { random, tick, fairValuePath } = context
  const from = Math.max(0, tick - MOMENTUM_WINDOW)
  const drift = fairValuePath[tick] - fairValuePath[from]

  if (Math.abs(drift) < 0.04) {
    if (random.chance(0.1)) {
      return { side: random.chance(0.5) ? 'buy' : 'sell', size: random.int(1, 2) }
    }
    return null
  }

  if (!random.chance(0.55)) return null

  return {
    side: drift > 0 ? 'buy' : 'sell',
    size: random.int(2, 4),
  }
}
