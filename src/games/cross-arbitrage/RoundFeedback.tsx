import { useMemo } from 'react'
import type { ArbitrageRoundResult, CrossArbitrageScenario } from '@/types/game'
import { formatNumber, pnlColor } from '@/lib/formatting'
import { formatEdge, routeLabel, sizeLabel } from './scoring'
import { roundPresentation } from './roundPresentation'
import { RoundExecutionDetails } from './RoundExecutionDetails'
import './RoundFeedback.css'

export function RoundFeedback({ round, scenario, remainingMs, durationMs, finalRound }: {
  round: ArbitrageRoundResult
  scenario: CrossArbitrageScenario
  remainingMs: number
  durationMs: number
  finalRound: boolean
}) {
  const presentation = useMemo(() => roundPresentation(round, scenario), [round, scenario])
  const percent = round.capitalReturn * 100
  const roundedPercent = Number(percent.toFixed(2))
  const comparison = presentation.comparison
  const seconds = formatNumber(Math.ceil(remainingMs / 100) / 10, 1)

  return <section className="arb-panel arb-round-result" aria-label="Результат раунда">
    <header className="arb-panel-head"><h2>Результат раунда</h2></header>
    <div className="arb-round-body">
      <div className="arb-round-outcome" role="status">
        <h3>{round.timedOut ? 'Время вышло — сделка не совершена' : round.choseNoTrade ? 'Сделка пропущена' : 'Сделка исполнена'}</h3>
        <strong className={pnlColor(roundedPercent)}>{formatEdge(percent)}</strong>
        <p>Изменение капитала раунда</p>
        {percent !== 0 && roundedPercent === 0 && <p className="arb-round-rounding">Результат округлён до 0,00%.</p>}
      </div>
      <RoundExecutionDetails round={round} scenario={scenario} />
      <div className="arb-round-observation"><p>{presentation.observation}</p>
        {presentation.bestExecution && <p>Вы выбрали лучший доступный маршрут и объём по чистому результату.</p>}
      </div>
      {comparison && <div className="arb-round-alternative">
        <h3>{presentation.comparisonTitle}</h3>
        <p>{routeLabel(scenario, comparison.buyVenue, comparison.sellVenue)} · {sizeLabel(comparison.positionSize)}</p>
        <p>Потенциальное изменение капитала раунда <strong>{formatEdge(comparison.capitalReturn * 100)}</strong></p>
        <span>{presentation.comparisonMoment}</span>
      </div>}
      <div className="arb-round-next">
        <p>{finalRound ? 'Результат испытания' : 'Следующий раунд'} через <span>{seconds} с</span></p>
        <progress max={durationMs} value={remainingMs} aria-label={finalRound ? 'До результата испытания' : 'До следующего раунда'} />
      </div>
    </div>
  </section>
}
