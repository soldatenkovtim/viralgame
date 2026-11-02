import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { PersonalBestNote } from '@/components/results/ResultBlocks'
import { ResultNavigation } from '@/components/results/ResultNavigation'
import { ScenarioReplay } from '@/components/results/ScenarioReplay'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { formatMoney, formatNumber, formatPercent, formatPrice, formatSeconds, plural, pnlColor } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { MarketShockResult as ShockResult, MarketShockScenario } from '@/types/game'
import { useGameStore, type SaveOutcome } from '@/store/gameStore'
import { actionLabels, actionPastLabels, initialExposure, positionLabel } from './engine'
import { MarketShockReplay } from './MarketShockReplay'
import { decisionPosition, sessionObservation, sourceLabel } from './resultPresentation'
import '../blind-market/BlindMarketResult.css'
import './MarketShockResult.css'

export function MarketShockResult({ scenario, result, outcome, nextHref, nextLabel }: {
  scenario: MarketShockScenario
  result: ShockResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const [selectedDecision, setSelectedDecision] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const mode = useGameStore(s => s.selectedMode)
  const nextCompleted = useGameStore(s => mode === 'advanced'
    ? s.advancedResults.some(r => r.challengeType === 'cross-arbitrage')
    : s.completedChallenges.includes('cross-arbitrage'))
  const sharePayload: SharePayload = {
    t: 'black-swan', s: scenario.id, d: scenario.seed,
    r: Number(result.pnlPercent.toFixed(2)),
    a: result.decisions.map(d => actionPastLabels[d.action]),
    e: result.decisions.map(d => d.positionAfter),
  }

  return <div className="blind-result shock-result">
    <header className="blind-result-header">
      <p className="blind-result-eyebrow">Испытание 03 · Рыночный шок</p>
      <h1>ИСПЫТАНИЕ ЗАВЕРШЕНО.</h1>
      <p className={`blind-result-headline tnum ${pnlColor(result.pnlPercent)}`}>Результат: {formatPercent(result.pnlPercent)}</p>
    </header>

    <section className="blind-result-summary" aria-label="Итоги прохождения">
      <div className="blind-result-metrics">
        <Stat label="Итоговый результат" value={formatPercent(result.pnlPercent)} valueClassName={pnlColor(result.pnlPercent)} hint={`${formatMoney(result.pnl)} игровых ед.`} />
        <Stat label="Максимальная просадка" value={formatPercent(-result.maxDrawdown)} />
        <Stat label="Максимальная экспозиция" value={`${Math.round(result.maxExposure * 100)}%`} />
        <Stat label="Минимальная экспозиция" value={`${Math.round(result.minExposure * 100)}%`} />
        <Stat label="Изменений позиции" value={`${result.positionChanges} ${plural(result.positionChanges, ['раз', 'раза', 'раз'])}`} />
        <Stat label="Среднее время решения" value={formatSeconds(result.averageDecisionMs)} />
      </div>
      <div className="blind-result-notes">
        <span className="tnum">Очки испытания · <strong>{formatNumber(outcome.points)}</strong></span>
        {outcome.previousBest !== null && <PersonalBestNote isPersonalBest={outcome.isPersonalBest} pointsToBest={outcome.pointsToBest} points={outcome.points} hasPrevious />}
      </div>
    </section>

    <section className="blind-result-market" aria-label="Раскрытый рынок">
      <div><p className="blind-result-eyebrow">{scenario.asset.assetClass === 'index' ? 'Рынок' : 'Вы торговали'}</p><h2>{scenario.revealAsset}</h2><p>{scenario.asset.exchange} · {scenario.revealPeriod}</p></div>
      <div className="blind-result-market-context">
        <p className="shock-result-context">{scenario.revealEvent}</p>
        <p>{scenario.revealDescription}</p>
        {!scenario.synthetic && <div><span>Исторические данные · {scenario.baseTimeframe === '15m' ? '15 минут' : '1 день'} · старшие свечи агрегированы</span>{scenario.sourceUrl && <a href={scenario.sourceUrl} target="_blank" rel="noreferrer">Источник · {sourceLabel(scenario.sourceUrl)} ↗</a>}</div>}
      </div>
    </section>

    <section className="blind-result-session" aria-label="Разбор сессии">
      <h2>Разбор сессии</h2>
      <MarketShockReplay scenario={scenario} result={result} selectedDecision={selectedDecision} onSelectDecision={setSelectedDecision} onPlayingChange={setPlaying} />
    </section>

    <section className="blind-result-decisions" aria-label="Ваши решения">
      <h2>Ваши решения</h2>
      <p className="blind-result-decision-hint">Начальная позиция · {positionLabel(initialExposure(scenario))} · вход {formatPrice(scenario.initialPosition.entryPrice)}. Выберите точку на графике или карточку.</p>
      <ol className="blind-result-timeline">
        {result.decisions.map((decision, index) => <li key={decision.phase} className={selectedDecision === index ? 'is-selected' : undefined}>
          <button type="button" className="blind-result-decision-select" aria-label={`Выбрать точку решения ${String(decision.phase).padStart(2, '0')}`} aria-pressed={selectedDecision === index} disabled={playing} onClick={() => setSelectedDecision(index)} />
          <p className="blind-result-eyebrow">Точка решения {String(decision.phase).padStart(2, '0')}</p>
          <h3>{decision.timedOut ? 'Без подтверждения' : actionLabels[decision.action]} · {decisionPosition(decision)}</h3>
          <dl>
            <div><dt>Цена</dt><dd>{formatPrice(decision.price)}</dd></div>
            <div><dt>PnL в точке</dt><dd className={pnlColor(decision.pnlBefore)}>{formatPercent(decision.pnlBefore)}</dd></div>
            <div><dt>Время решения</dt><dd>{formatSeconds(decision.decisionTimeMs)}</dd></div>
          </dl>
          {decision.timedOut && <p className="blind-result-observation">Время истекло. Позиция сохранена.</p>}
        </li>)}
      </ol>
    </section>

    <section className="shock-result-observation"><h2>Главное наблюдение</h2><p>{sessionObservation(result, scenario)}</p></section>

    <ScenarioReplay challengeType="black-swan" scenarioId={scenario.id}>
      {({ completed, total, remaining, onReplay }) => <section className="blind-result-next">
        <div className="blind-result-next-primary">
          <div><h2>Что дальше</h2><p>Вы прошли {completed} из {total} сценариев этого испытания. {remaining > 0 ? `Доступно ещё ${remaining} ${plural(remaining, ['сценарий', 'сценария', 'сценариев'])}.` : 'Все сценарии этого испытания пройдены.'}</p></div>
          <LinkButton to={nextHref} variant="primary" size="lg">{nextCompleted && nextHref !== '/profile' ? 'Вернуться к последнему испытанию' : nextLabel}<ArrowRight size={18} aria-hidden /></LinkButton>
        </div>
        <div className="blind-result-secondary"><Button variant="secondary" onClick={onReplay}>{remaining ? 'Попробовать другой сценарий' : 'Сыграть случайный сценарий'}</Button><div className="blind-result-share"><ShareChallengeButton payload={sharePayload} /></div></div>
        <ResultNavigation />
      </section>}
    </ScenarioReplay>
    <Disclaimer>Результат описывает только эту игровую сессию и не является оценкой профессиональной квалификации.</Disclaimer>
  </div>
}
