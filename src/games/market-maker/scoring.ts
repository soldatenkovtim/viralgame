import { clamp, mapRange } from '@/lib/random'
import type { MarketMakerResult } from '@/types/game'

type MarketMakerMetrics = Omit<MarketMakerResult, 'score'>

/** Игровой score испытания, 0–100. */
export function marketMakerScore(result: MarketMakerMetrics): number {
  const pnlScore = mapRange(result.pnl, -600, 900, 0, 100)
  const inventoryScore = mapRange(result.maxInventory, 3, 26, 100, 10)
  const adverseScore = mapRange(result.adverseSelectionLoss, 0, 500, 100, 10)

  return clamp(pnlScore * 0.55 + inventoryScore * 0.25 + adverseScore * 0.2, 0, 100)
}

export interface MarketMakerTraits {
  pricing: number
  riskControl: number
  adaptability: number
}

export function marketMakerTraits(result: MarketMakerResult): MarketMakerTraits {
  // Ценообразование: сколько спреда удалось забрать и во что это превратилось.
  const edgePerTrade = result.tradeCount > 0 ? result.grossEdge / result.tradeCount : 0
  const pricing =
    mapRange(result.pnl, -600, 900, 8, 100) * 0.55 +
    mapRange(edgePerTrade, -0.4, 1.2, 15, 100) * 0.3 +
    mapRange(result.tradeCount, 2, 30, 30, 95) * 0.15

  // Контроль риска: размер инвентаря, остаток на конце и осмысленность хеджа.
  const hedgeSanity = hedgeSanityScore(result)
  const riskControl =
    mapRange(result.maxInventory, 3, 26, 100, 12) * 0.5 +
    mapRange(Math.abs(result.finalInventory), 0, 14, 100, 20) * 0.25 +
    hedgeSanity * 0.25

  // Адаптивность: реагировал ли игрок на изменение характера потока.
  const spreadResponse = result.spreadSecondHalf - result.spreadFirstHalf
  const toxicFlow = result.botType === 'informed'
  const responseScore = toxicFlow
    ? mapRange(spreadResponse, -0.3, 0.6, 22, 100)
    : mapRange(-Math.abs(spreadResponse), -0.6, 0, 40, 92)
  const activityScore = mapRange(result.spreadChanges + result.quoteMoves, 0, 22, 25, 95)
  const adaptability = responseScore * 0.6 + activityScore * 0.4

  return {
    pricing: clamp(pricing, 0, 100),
    riskControl: clamp(riskControl, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
  }
}

/**
 * Хедж оценивается по уместности, а не по количеству:
 * большой инвентарь без единого хеджа и хедж на пустом месте — обе крайности.
 */
function hedgeSanityScore(result: MarketMakerMetrics): number {
  if (result.maxInventory >= 12) {
    return mapRange(result.hedgeCount, 0, 3, 30, 100)
  }
  if (result.hedgeCount === 0) return 78
  return mapRange(result.hedgeCount, 1, 6, 88, 45)
}

/**
 * Нарратив раунда. Описывает поведение в сессии и никогда не оценивает игрока.
 */
export function marketMakerNarrative(result: MarketMakerResult): string {
  const widened = result.spreadSecondHalf - result.spreadFirstHalf > 0.12
  const narrowed = result.spreadFirstHalf - result.spreadSecondHalf > 0.12
  const heavyInventory = result.maxInventory >= 12
  const hedged = result.hedgeCount > 0

  if (result.botType === 'informed') {
    if (widened && hedged) {
      return 'Ты быстро увеличил спред и сократил инвентарь после того, как характер потока изменился.'
    }
    if (widened) {
      return 'Ты расширил спред в ответ на поток, но инвентарь при этом продолжал накапливаться.'
    }
    return 'Ты долго сохранял узкий спред даже после того, как поток стал токсичным.'
  }

  if (result.botType === 'momentum') {
    if (heavyInventory && !hedged) {
      return 'Инвентарь накапливался против направления рынка, и ты держал его до конца раунда.'
    }
    if (hedged) {
      return 'Ты сбрасывал инвентарь по ходу движения, вместо того чтобы пережидать его в позиции.'
    }
    return 'Ты двигал котировку вслед за потоком и удерживал позицию в умеренных границах.'
  }

  if (narrowed) {
    return 'Ты сужал спред, чтобы собрать больше сделок в спокойном потоке.'
  }
  if (result.tradeCount < 10) {
    return 'Ты держал осторожную котировку и торговал редко, отдавая часть потока.'
  }
  return 'Ты работал широким потоком сделок и удерживал инвентарь вблизи нуля.'
}
