import { MM_SOFT_INVENTORY_LIMIT } from '@/data/marketMakerScenarios'
import { clamp, mapRange } from '@/lib/random'
import type { MarketMakerResult } from '@/types/game'

type MarketMakerMetrics = Omit<MarketMakerResult, 'score'>

export interface MarketMakerScoreParts {
  pnl: number
  inventoryControl: number
  spreadCapture: number
  adverseSelection: number
}

/** Штраф к PnL в score за каждую секунду над мягким лимитом inventory. */
const RISK_CHARGE_PER_SECOND = 40

export function marketMakerScoreParts(result: MarketMakerMetrics): MarketMakerScoreParts {
  // PnL в score учитывается с поправкой на риск, чтобы удачно пересиженная
  // крупная позиция не обгоняла аккуратную работу со спредом.
  const riskAdjustedPnl = result.pnl - result.secondsAboveSoftLimit * RISK_CHARGE_PER_SECOND
  const pnl = mapRange(riskAdjustedPnl, -2500, 1600, 0, 100)

  // Крупный inventory и долгое время над лимитом снижают оценку,
  // даже если рынок случайно пошёл в сторону позиции.
  const inventoryControl =
    mapRange(result.maxInventory, 10, 32, 100, 0) * 0.55 +
    mapRange(result.secondsAboveSoftLimit, 0, 25, 100, 0) * 0.3 +
    mapRange(Math.abs(result.finalInventory), 0, MM_SOFT_INVENTORY_LIMIT, 100, 20) * 0.15

  const spreadCapture = mapRange(result.spreadPnl, 0, 2400, 0, 100)

  // Adverse selection меряем относительно заработанного спреда:
  // сколько собранного потока забрали информированные контрагенты.
  const adverseShare = result.adverseSelectionLoss / Math.max(result.spreadPnl, 400)
  const adverseSelection = mapRange(adverseShare, 0.25, 1.4, 100, 0)

  return { pnl, inventoryControl, spreadCapture, adverseSelection }
}

/** Игровой score испытания, 0–100. */
export function marketMakerScore(result: MarketMakerMetrics): number {
  const parts = marketMakerScoreParts(result)
  return clamp(
    parts.pnl * 0.5 +
      parts.inventoryControl * 0.25 +
      parts.spreadCapture * 0.15 +
      parts.adverseSelection * 0.1,
    0,
    100,
  )
}

export interface MarketMakerTraits {
  pricing: number
  riskControl: number
  adaptability: number
}

export function marketMakerTraits(result: MarketMakerResult): MarketMakerTraits {
  const parts = marketMakerScoreParts(result)

  const pricing = parts.pnl * 0.45 + parts.spreadCapture * 0.35 + parts.adverseSelection * 0.2

  const riskControl = parts.inventoryControl * 0.75 + hedgeSanityScore(result) * 0.25

  // Адаптивность: защищался ли игрок ценой, когда поток становился направленным,
  // и насколько котировка поспевала за рынком.
  const toxicPhases = result.phases.filter((phase) => phase.regime !== 'noise')
  const lag = toxicPhases.length
    ? toxicPhases.reduce((sum, phase) => sum + phase.averageQuoteLag, 0) / toxicPhases.length
    : 0.4
  const responseScore = mapRange(result.spreadDirectional - result.spreadNoise, -0.3, 0.5, 20, 100)
  const lagScore = mapRange(lag, 0.15, 1.2, 100, 15)
  const activityScore = mapRange(result.spreadChanges + result.quoteMoves, 0, 30, 20, 95)
  const adaptability = responseScore * 0.4 + lagScore * 0.35 + activityScore * 0.25

  return {
    pricing: clamp(pricing, 0, 100),
    riskControl: clamp(riskControl, 0, 100),
    adaptability: clamp(adaptability, 0, 100),
  }
}

/**
 * Хедж оценивается по уместности, а не по количеству:
 * большой inventory без хеджа и хедж на пустом месте — обе крайности.
 */
function hedgeSanityScore(result: MarketMakerMetrics): number {
  if (result.maxInventory >= MM_SOFT_INVENTORY_LIMIT) {
    return mapRange(result.hedgeCount, 0, 2, 30, 100)
  }
  if (result.hedgeCount === 0) return 80
  return mapRange(result.hedgeCount, 1, 6, 85, 40)
}

/**
 * 1–2 нейтральных наблюдения о раунде. Описывают поведение и никогда
 * не оценивают игрока.
 */
export function marketMakerInsights(result: MarketMakerResult): string[] {
  const candidates: { priority: number; text: string }[] = []

  const directional = result.phases.filter((phase) => phase.regime !== 'noise')
  const directionalSpread = result.spreadDirectional
  const keptNarrow =
    directional.length > 0 &&
    directionalSpread <= result.spreadNoise + 0.05 &&
    directionalSpread < 0.75
  const widened = directional.length > 0 && directionalSpread - result.spreadNoise >= 0.2

  if (keptNarrow) {
    candidates.push({
      priority: 5,
      text: 'Ты долго сохранял узкий спред после того, как поток стал направленным.',
    })
  } else if (widened) {
    candidates.push({
      priority: 4,
      text: 'Когда поток стал направленным, ты расширил спред и стал реже отдавать котировку.',
    })
  }

  const lagging = directional.some((phase) => phase.averageQuoteLag > 0.6)
  if (lagging) {
    candidates.push({
      priority: 3,
      text: 'Во время направленного движения середина твоей котировки заметно отставала от справедливой цены.',
    })
  }

  if (result.inventoryResponseSeconds !== null) {
    if (result.inventoryResponseSeconds <= 3) {
      candidates.push({
        priority: 4,
        text: 'После роста inventory ты быстро сместил котировки и сократил позиционный риск.',
      })
    } else if (result.inventoryResponseSeconds >= 8) {
      candidates.push({
        priority: 4,
        text: 'Крупный inventory оставался на балансе заметное время, прежде чем котировки сместились против позиции.',
      })
    }
  }

  const spreadDominates = result.spreadPnl > 0 && result.spreadPnl >= Math.abs(result.inventoryPnl) * 2
  const inventoryDominates = Math.abs(result.inventoryPnl) > Math.max(result.spreadPnl, 0)
  if (spreadDominates) {
    candidates.push({
      priority: 2,
      text: 'Большая часть твоего PnL пришла от spread capture, а не от движения inventory.',
    })
  } else if (inventoryDominates) {
    candidates.push({
      priority: 3,
      text:
        result.inventoryPnl < 0
          ? 'Переоценка inventory забрала больше, чем принёс заработок на спреде.'
          : 'Результат раунда определило движение inventory сильнее, чем заработок на спреде.',
    })
  }

  if (result.hedgeCount >= 4) {
    candidates.push({
      priority: 3,
      text: 'Ты часто хеджировал позицию, снижая риск ценой дополнительных издержек.',
    })
  } else if (result.hedgeCount === 0 && result.maxInventory > MM_SOFT_INVENTORY_LIMIT) {
    candidates.push({
      priority: 3,
      text: 'Ты не использовал хедж, и позиционный риск всё время оставался на твоём балансе.',
    })
  }

  if (!candidates.length) {
    candidates.push({
      priority: 1,
      text: 'Ты держал котировку рядом с рынком и удерживал inventory в умеренных границах.',
    })
  }

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map((candidate) => candidate.text)
}
