/**
 * Детерминированный генератор псевдослучайных чисел (mulberry32).
 *
 * Все рыночные сценарии строятся только из seed, поэтому shared-ссылка
 * воспроизводит у другого игрока точно тот же рынок.
 */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    // Нормализуем seed в 32-битное беззнаковое, ненулевое значение.
    this.state = (seed >>> 0) || 0x9e3779b9
  }

  /** Равномерное [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Равномерное [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Целое [min, max] включительно. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** Нормальное распределение через преобразование Бокса — Мюллера. */
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-9)
    const u2 = this.next()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z * stdDev
  }

  /** true с заданной вероятностью. */
  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]
  }
}

export function createRandom(seed: number): SeededRandom {
  return new SeededRandom(seed)
}

/** Стабильный числовой хеш строки — для вывода seed из идентификаторов. */
export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Линейное отображение значения из одного диапазона в другой с отсечением. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1)
  return outMin + t * (outMax - outMin)
}
