import { advancedArbitrageScenarios } from '@/data/advanced/scenarios'
import { crossArbitrageScenarios } from '@/data/crossArbitrageScenarios'
import type { ArbitrageRoundResult, CrossArbitrageScenario } from '@/types/game'
import { sizeLabel } from './scoring'

/** Resolve by the saved round ID, never by the currently selected session or a default market. */
export function resolveRoundScenario(id: string, scenarios: CrossArbitrageScenario[] = []) {
  return scenarios.find(scenario => scenario.id === id)
    ?? crossArbitrageScenarios.find(scenario => scenario.id === id)
    ?? advancedArbitrageScenarios.find(scenario => scenario.id === id)
}

export function roundInstrument(id: string, scenarios: CrossArbitrageScenario[] = []) {
  return resolveRoundScenario(id, scenarios)?.asset ?? 'Инструмент не указан'
}

/** Missing historical fields are unavailable data, not evidence of a skipped trade. */
export function roundExecutionDisplay(round: ArbitrageRoundResult, scenario?: CrossArbitrageScenario) {
  const resolved = resolveRoundScenario(round.scenarioId, scenario ? [scenario] : [])
  const buy = resolved?.quotes.find(quote => quote.venueId === round.buyVenue)?.venueName
  const sell = resolved?.quotes.find(quote => quote.venueId === round.sellVenue)?.venueName
  const route = buy || sell ? `${buy ?? 'Площадка не указана'} → ${sell ?? 'Площадка не указана'}` : 'Маршрут не сохранён'
  const size = Number.isFinite(round.positionSize) && round.positionSize > 0 ? sizeLabel(round.positionSize) : 'Объём не сохранён'
  return { route, size, summary: round.timedOut ? 'Время на решение истекло'
    : round.choseNoTrade ? 'Отказ от сделки' : `${route} · ${size}` }
}
