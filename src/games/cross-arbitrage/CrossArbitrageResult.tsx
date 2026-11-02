import { useMemo } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { PersonalBestNote } from '@/components/results/ResultBlocks'
import { ResultNavigation } from '@/components/results/ResultNavigation'
import { ScenarioReplay } from '@/components/results/ScenarioReplay'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { crossArbitrageAchievement } from '@/lib/achievements'
import { formatNumber, plural, pnlColor } from '@/lib/formatting'
import { scaleTrait, traitLabels } from '@/lib/profile'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import type { ArbitrageRoundResult, CrossArbitrageResult as ArbResult, CrossArbitrageScenario, CrossArbitrageSession } from '@/types/game'
import { RoundExecutionDetails } from './RoundExecutionDetails'
import { resolveRoundScenario, roundExecutionDisplay, roundInstrument } from './roundDisplay'
import { roundPresentation } from './roundPresentation'
import { buildQuotePath } from './engine'
import { resultCounts, resultNextStep, roundStatus, sessionObservation } from './resultPresentation'
import { buildArbitrageSharePayload, crossArbitrageTraits, formatDecisionSeconds, formatEdge, routeLabel, sizeLabel, type CrossArbitrageTraits } from './scoring'
import '../blind-market/BlindMarketResult.css'
import './CrossArbitrageResult.css'

const PROFILE_CONTRIBUTION: { trait: keyof CrossArbitrageTraits; share: string }[] = [
  { trait: 'opportunity', share: '50%' },
  { trait: 'discipline', share: '30%' },
  { trait: 'adaptability', share: '20%' },
]
const resultColor = (percent: number) => pnlColor(Number(percent.toFixed(2)))

export function CrossArbitrageResult({ session, result, outcome }: {
  session: CrossArbitrageSession
  result: ArbResult
  outcome: SaveOutcome
}) {
  const completedChallenges = useGameStore(s => s.completedChallenges)
  const unlockedChallenges = useGameStore(s => s.unlockedChallenges)
  const advancedResults = useGameStore(s => s.advancedResults)
  const next = resultNextStep({ completedChallenges, unlockedChallenges, advancedResults }, session.mode === 'advanced')
  const scenarios = useMemo(() => result.rounds.flatMap(round => {
    const scenario = resolveRoundScenario(round.scenarioId, session.scenarios)
    return scenario ? [scenario] : []
  }), [result.rounds, session.scenarios])
  const achievement = useMemo(() => crossArbitrageAchievement(result), [result])
  const traits = useMemo(() => crossArbitrageTraits(result), [result])
  const counts = resultCounts(result)

  return <div className="blind-result arb-result">
    <header className="blind-result-header">
      <p className="blind-result-eyebrow">Испытание 04 · Кросс-арбитраж</p>
      <h1>ИСПЫТАНИЕ ЗАВЕРШЕНО.</h1>
      <p className={`arb-result-total tnum ${resultColor(result.totalReturnPercent)}`}>{formatEdge(result.totalReturnPercent)}</p>
      <p className="arb-result-caption">Изменение капитала за {result.rounds.length} раундов</p>
      {next.complete && <p className="arb-result-complete">Все четыре стандартных испытания пройдены</p>}
    </header>

    <section className="blind-result-summary" aria-label="Итоги прохождения">
      <div className="blind-result-metrics">
        <Stat label="Очки испытания" value={formatNumber(outcome.points)} />
        <Stat label="Прибыльных сделок" value={counts.profitable} />
        <Stat label="Убыточных сделок" value={counts.losing} />
        <Stat label="Пропущено раундов" value={counts.skipped} hint={counts.timedOut ? `Из них по тайм-ауту: ${counts.timedOut}` : undefined} />
        <Stat label="Среднее время решения" value={formatDecisionSeconds(result.averageDecisionMs)} />
        <Stat label="Общий результат" value={formatEdge(result.totalReturnPercent)} valueClassName={resultColor(result.totalReturnPercent)} />
      </div>
      {(outcome.previousBest !== null || achievement) && <div className="blind-result-notes">
        {outcome.previousBest !== null && <PersonalBestNote isPersonalBest={outcome.isPersonalBest} pointsToBest={outcome.pointsToBest} points={outcome.points} hasPrevious />}
        {achievement && <p><span className="blind-result-eyebrow">Достижение</span> · {achievement.title} · {achievement.id === 'clean-spread' ? 'Ни одной сделки с отрицательной доходностью после издержек.' : achievement.description}</p>}
      </div>}
    </section>

    <section className="arb-result-observation" aria-labelledby="arb-observation-title">
      <h2 id="arb-observation-title">Главное наблюдение</h2>
      <p>{sessionObservation(result)}</p>
    </section>

    <section className="arb-result-history" aria-labelledby="arb-history-title">
      <div className="arb-result-section-heading"><h2 id="arb-history-title">История пяти раундов</h2><p>Раскройте раунд, чтобы увидеть исполнение и издержки.</p></div>
      <ol>{result.rounds.map((round, index) => <li key={`${round.scenarioId}-${index}`}>
        <RoundHistory round={round} scenario={scenarios.find(s => s.id === round.scenarioId)} index={index} />
      </li>)}</ol>
      <p className="arb-result-caption">Общий результат — сумма неокруглённых изменений капитала раундов с учётом объёма. Проценты на экране округлены до сотых, поэтому их сумма может отличаться от итога.</p>
      <details className="arb-result-extra">
        <summary>Дополнительная статистика<ChevronDown size={16} aria-hidden /></summary>
        <div className="blind-result-metrics">
          <Stat label="Лучшее ценовое преимущество после издержек" value={result.bestEdgePercent > 0 ? formatEdge(result.bestEdgePercent) : '—'} hint="На единицу объёма среди прибыльных сделок." />
          <Stat label="Средний размер сделки" value={`${formatNumber(result.averageSizeUnits ?? 0, 1)} ед.`} />
          <Stat label="Объём ухудшил исполнение" value={`${result.sizeWorsenedCount ?? 0} ${plural(result.sizeWorsenedCount ?? 0, ['раз', 'раза', 'раз'])}`} hint="Объём превысил ликвидность по лучшей цене, снизив доходность после комиссий." />
          <Stat label="Найдено возможностей" value={`${result.found} / ${result.opportunities}`} hint="Прибыльные сделки в раундах, где на старте был прибыльный маршрут, из всех таких раундов." />
          <Stat label="Сделок без прибыли" value={result.falseTrades} hint="Классификация скоринга: убыточные и нулевые сделки. Пропуски не учитываются." />
          <Stat label="Пропущено возможностей" value={result.missed} hint="Раунды без сделки, в которых на старте был прибыльный маршрут; включая тайм-ауты." />
        </div>
      </details>
    </section>

    <section className="arb-result-profile" aria-labelledby="arb-profile-title">
      <div><h2 id="arb-profile-title">Ваш результат по трём характеристикам</h2>
        <p>Оценки отражают ваши решения в испытании «Кросс-арбитраж». Общий торговый профиль объединяет результаты всех испытаний.</p>
        {session.mode === 'advanced' && <p className="arb-result-caption">Оценки этого продвинутого сценария; стандартный профиль не пересчитывается.</p>}
      </div>
      <div className="arb-result-traits">{PROFILE_CONTRIBUTION.map(({ trait, share }) => {
        const value = scaleTrait(traits[trait])
        return <div key={trait}>
          <div className="arb-result-trait-label"><span>{traitLabels[trait]} <small>· вес {share}</small></span><span className="tnum">{value}<small> / 100</small></span></div>
          <div className="arb-result-meter" role="meter" aria-label={traitLabels[trait]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div>
        </div>
      })}</div>
    </section>

    <ScenarioReplay challengeType="cross-arbitrage" scenarioId={session.id}>
      {({ completed, total, remaining, onReplay }) => <section className="blind-result-next" aria-labelledby="arb-next-title">
        <div className="blind-result-next-primary">
          <div><h2 id="arb-next-title">Что дальше</h2><p>Вы прошли {completed} из {total} сценариев этого испытания. {remaining ? `Доступно ещё ${remaining} ${plural(remaining, ['сценарий', 'сценария', 'сценариев'])}.` : 'Все сценарии этого испытания пройдены.'}</p></div>
          <LinkButton to={next.to} variant="primary" size="lg">{next.label}<ArrowRight size={18} aria-hidden /></LinkButton>
        </div>
        <div className="blind-result-secondary"><Button variant="secondary" onClick={onReplay}>{remaining ? 'Попробовать другой сценарий' : 'Сыграть случайный сценарий'}</Button><div className="blind-result-share"><ShareChallengeButton payload={buildArbitrageSharePayload(session, result)} /></div></div>
        <ResultNavigation />
      </section>}
    </ScenarioReplay>
    <Disclaimer>Котировки смоделированы. Характеристики относятся только к игровому симулятору и не являются оценкой профессиональной квалификации.</Disclaimer>
  </div>
}

export function RoundHistory({ round, scenario: suppliedScenario, index }: { round: ArbitrageRoundResult; scenario?: CrossArbitrageScenario; index: number }) {
  const scenario = resolveRoundScenario(round.scenarioId, suppliedScenario ? [suppliedScenario] : [])
  const execution = roundExecutionDisplay(round, scenario)
  const presentation = useMemo(() => scenario && Number.isInteger(round.quoteStep) && round.quoteStep >= 0
    && round.quoteStep < buildQuotePath(scenario).length ? roundPresentation(round, scenario) : undefined, [round, scenario])
  const comparison = presentation?.comparison
  const percent = round.capitalReturn * 100
  return <details className="arb-history-round">
    <summary>
      <span className="arb-history-number">{String(index + 1).padStart(2, '0')}</span>
      <span className="arb-history-instrument"><strong>{roundInstrument(round.scenarioId, scenario ? [scenario] : [])}</strong><span>{roundStatus(round)}</span></span>
      <span className="arb-history-route">{execution.summary}</span>
      <span className={`arb-history-return tnum ${resultColor(percent)}`}>{formatEdge(percent)}</span>
      <ChevronDown className="arb-history-chevron" size={18} aria-hidden />
    </summary>
    <div className="arb-history-detail">
      <RoundExecutionDetails round={round} scenario={scenario} />
      <dl className="arb-history-capital"><div><dt>Изменение капитала раунда</dt><dd className={resultColor(percent)}>{formatEdge(percent)}</dd></div><div><dt>Время решения</dt><dd>{formatDecisionSeconds(round.decisionTimeMs)}</dd></div></dl>
      {percent !== 0 && Number(percent.toFixed(2)) === 0 && <p>Результат округлён до 0,00%.</p>}
      {round.timedOut && <p>Время на решение истекло. Сделка не совершена.</p>}
      {presentation && <p>{presentation.observation}</p>}
      {!round.choseNoTrade && round.liquidityHit && <p>Объём превысил доступную ликвидность по лучшей цене. Часть сделки исполнена на следующих уровнях.</p>}
      {comparison && scenario && <div className="arb-history-alternative">
        <h3>{presentation.comparisonTitle}</h3>
        <p>{routeLabel(scenario, comparison.buyVenue, comparison.sellVenue)} · {sizeLabel(comparison.positionSize)} · <span className="text-market-up tnum">{formatEdge(comparison.capitalReturn * 100)}</span> к капиталу раунда</p>
        <p>{presentation.comparisonMoment}</p>
      </div>}
    </div>
  </details>
}
