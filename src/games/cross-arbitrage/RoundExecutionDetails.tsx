import type { ArbitrageRoundResult, CrossArbitrageScenario } from '@/types/game'
import { formatPrice } from '@/lib/formatting'
import { formatEdge } from './scoring'
import { roundExecutionDisplay } from './roundDisplay'

/** The same saved execution figures in intermediate and final results. */
export function RoundExecutionDetails({ round, scenario }: { round: ArbitrageRoundResult; scenario?: CrossArbitrageScenario }) {
  if (round.choseNoTrade || round.timedOut) return null
  const execution = roundExecutionDisplay(round, scenario)
  return <>
    <dl className="arb-round-execution">
      <div><dt>Маршрут</dt><dd>{execution.route}</dd></div>
      <div><dt>Исполнено</dt><dd>{execution.size}</dd></div>
      <div><dt>Средняя цена покупки</dt><dd>{round.avgBuyPrice === undefined ? '—' : formatPrice(round.avgBuyPrice)}</dd></div>
      <div><dt>Средняя цена продажи</dt><dd>{round.avgSellPrice === undefined ? '—' : formatPrice(round.avgSellPrice)}</dd></div>
    </dl>
    <dl className="arb-round-costs">
      <div><dt>Разница цен</dt><dd>{formatEdge(round.grossReturn * 100)}</dd></div>
      <div><dt>Комиссии</dt><dd>{round.feeReturn === undefined ? '—' : formatEdge(-round.feeReturn * 100)}</dd></div>
      <div><dt>Проскальзывание</dt><dd>{round.slippageReturn === undefined ? '—' : formatEdge(-round.slippageReturn * 100)}</dd></div>
      <div className="arb-round-yield"><dt>Доходность сделки после издержек</dt><dd>{formatEdge(round.netReturn * 100)}</dd></div>
    </dl>
    <p className="arb-round-basis">Доходность и издержки — от цены Ask в момент сделки.</p>
  </>
}
