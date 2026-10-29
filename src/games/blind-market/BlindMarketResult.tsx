import { useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { CrowdStats, PersonalBestNote } from '@/components/results/ResultBlocks'
import { ResultNavigation } from '@/components/results/ResultNavigation'
import { ScenarioReplay } from '@/components/results/ScenarioReplay'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { blindMarketAchievement } from '@/lib/achievements'
import { formatPrice, plural, pnlColor } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { BlindMarketResult as BlindResult, BlindMarketScenario } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import { infoLabels } from './InfoSelector'
import { BlindReplay } from './BlindReplay'
import { positionEvents, positionEventLabels } from './positionAnalysis'
import { actionShortLabels } from './scoring'
import { decisionObservation, formatCapitalChange, formatResultPercent, isFiniteMarketReturn, scoreContributions } from './resultAnalysis'
import { formatPositionSize, formatPositionLabel } from './terminalFormatting'
import './BlindMarketResult.css'

export function BlindMarketResult({ scenario, result, outcome, nextHref, nextLabel }: {
  scenario: BlindMarketScenario
  result: BlindResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => blindMarketAchievement(result, scenario.mode), [result, scenario.mode])
  const sharePayload: SharePayload = {
    t: 'blind-market', s: scenario.id, d: scenario.seed,
    r: Number(result.pnlPercent.toFixed(2)),
    a: result.decisions.map((decision, index) => index === 0
      ? formatPositionLabel(decision.exposure)
      : actionShortLabels[decision.action ?? 'hold']),
    e: result.decisions.map(decision => decision.exposure),
  }
  const changes = result.directionChanges
  const events = positionEvents(result.decisions, result.stopHits)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<number | null>(null)
  const [replaying, setReplaying] = useState(false)
  const replayRef = useRef<HTMLDivElement>(null)
  const contributions = scoreContributions(result.pnlPercent, result.maxDrawdown)
  const componentPoints = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

  return <div className="blind-result">
    <header className="blind-result-header">
      <p className="blind-result-eyebrow">Испытание 01 · Слепой рынок</p>
      <h1>Испытание завершено.</h1>
      <p className={`blind-result-headline tnum ${pnlColor(result.pnlPercent)}`}>
        Результат: {formatResultPercent(result.pnlPercent)}
      </p>
    </header>

    <section className="blind-result-summary" aria-label="Итоги прохождения">
      <div className="blind-result-metrics">
        <Stat label="Изменение капитала" value={formatCapitalChange(result.pnl)} valueClassName={pnlColor(result.pnl)} hint="игровых ед. · от стартового капитала" />
        <div>
          <Stat label="Очки испытания" value={outcome.points.toLocaleString('ru-RU')} />
          <button type="button" className="blind-result-score-toggle" aria-expanded={scoreOpen} aria-controls="blind-score-explanation" onClick={() => setScoreOpen(!scoreOpen)}>Как рассчитаны очки?</button>
        </div>
        <Stat label="Максимальная просадка" value={formatResultPercent(-result.maxDrawdown)} />
        <Stat label="Средняя уверенность" value={`${Math.round(result.averageConfidence)}%`} />
        <Stat label="Изменения позиции" value={`${changes} ${plural(changes, ['раз', 'раза', 'раз'])}`} hint="Смена состояния между решениями, без учёта размера." />
        <Stat label="Открытые источники" value={`${result.selectedInformation.length} ${plural(result.selectedInformation.length, ['источник', 'источника', 'источников'])}`} hint={result.selectedInformation.map(key => infoLabels[key]).join(' · ')} />
      </div>
      <div id="blind-score-explanation" className="blind-result-score" hidden={!scoreOpen}>
        <p>Очки зависят от итоговой доходности всего стартового капитала и максимального снижения капитала от достигнутого пика. Просадка учитывает стоимость открытых позиций на расчётных точках, а не только закрытые сделки.</p>
        <dl>
          <div><dt>Доходность · вес 72%</dt><dd>{componentPoints(contributions.returnPoints)} из 7 200 очков</dd></div>
          <div><dt>Контроль просадки · вес 28%</dt><dd>{componentPoints(contributions.drawdownPoints)} из 2 800 очков</dd></div>
        </dl>
        <p>Доходность от −12% до +12% линейно повышает первый компонент от 0 до 7 200. Просадка от 0% до 12% снижает второй от 2 800 до 0. За пределами диапазонов компоненты не меняются.</p>
        <p>Компоненты суммируются, итог округляется до целого: <strong>{outcome.points.toLocaleString('ru-RU')} очков из 10 000</strong>. Значения компонентов показаны с точностью до сотых. Количество сделок само по себе не добавляет очков. Уверенность не влияет напрямую на очки, а выбор источников информации не даёт прямого бонуса.</p>
        <p>Если капитал не изменился и просадки не было, результат составит 6 400 очков: 3 600 за компонент доходности и 2 800 за компонент просадки. Это исходная точка текущей шкалы, а не оценка профессиональных навыков.</p>
        <p>Результаты разных рынков не нормализованы по сложности и волатильности. Очки не являются процентилем среди игроков.</p>
      </div>
      {(outcome.previousBest !== null || achievement) && <div className="blind-result-notes">
        {outcome.previousBest !== null && <PersonalBestNote isPersonalBest={outcome.isPersonalBest} pointsToBest={outcome.pointsToBest} points={outcome.points} hasPrevious />}
        {achievement && <p><strong>{achievement.title}</strong> · {achievement.description}</p>}
      </div>}
    </section>

    <AssetReveal scenario={scenario} />

    <section className="blind-result-session" aria-label="Разбор сессии и ваши решения">
      <div ref={replayRef}>
        <BlindReplay key={scenario.id} scenario={scenario} result={result} selectedDecision={selectedDecision} onPlayingChange={playing => { setReplaying(playing); if (playing) setSelectedDecision(null) }} />
      </div>
      <div className="blind-result-decisions">
        <h2>Разбор решений</h2>
        <p className="blind-result-decision-hint">Выберите карточку, чтобы увидеть точку решения на графике.</p>
        <ol className="blind-result-timeline">
          {result.decisions.map((decision, index) => {
            const marketReturn = result.segmentReturns?.[index]
            const stop = result.stopHits?.find(hit => hit.segment === index && Number.isFinite(hit.price))
            const action = positionEventLabels[events[index]]
            const observation = decisionObservation(decision, marketReturn, index === scenario.checkpoints.length - 1, events[index], stop)
            return <li key={decision.checkpointIndex} className={selectedDecision === index ? 'is-selected' : undefined}>
              <button type="button" className="blind-result-decision-select" aria-label={`Показать точку решения ${index + 1} на графике`} aria-pressed={selectedDecision === index} disabled={replaying} onClick={() => {
                setSelectedDecision(index)
                replayRef.current?.scrollIntoView({ block: 'nearest' })
              }} />
              <p className="blind-result-eyebrow">Точка решения {String(index + 1).padStart(2, '0')}</p>
              <h3>{action}</h3>
              <dl>
                <div><dt>После действия</dt><dd>{decision.exposure === 0 ? 'Вне рынка' : decision.exposure > 0 ? 'Лонг' : 'Шорт'}</dd></div>
                <div><dt>Размер позиции</dt><dd>{formatPositionSize(decision.exposure)}</dd></div>
                <div><dt>Уверенность</dt><dd>{decision.confidence}%</dd></div>
              </dl>
              <p className="blind-result-aftermath">
                {index === scenario.checkpoints.length - 1 ? 'Рынок до завершения' : 'Рынок до следующей точки'}
                {isFiniteMarketReturn(marketReturn) ? <>: <span className={`tnum ${pnlColor(marketReturn)}`}>{formatResultPercent(marketReturn)}</span></> : ": нет данных"}
              </p>
              {observation && <p className="blind-result-observation">{observation}</p>}
              {stop && <p className="blind-result-stop">Стоп сработал по {formatPrice(stop.price)}. Позиция закрыта.</p>}
            </li>
          })}
        </ol>
      </div>
      {scenario.crowd.length > 0 && <CrowdStats title="На второй точке:" items={scenario.crowd} />}
    </section>

    <ScenarioReplay challengeType="blind-market" scenarioId={scenario.id}>
      {({ completed, total, remaining, onReplay }) => <section className="blind-result-next" aria-labelledby="blind-result-next-title">
        <div className="blind-result-next-primary">
          <div>
            <h2 id="blind-result-next-title">Что дальше</h2>
            <p>Вы прошли {completed} из {total} сценариев этого испытания.{' '}
              {remaining > 0 ? `Доступно ещё ${remaining} ${plural(remaining, ['сценарий', 'сценария', 'сценариев'])}.` : 'Все сценарии этого испытания пройдены.'}
            </p>
          </div>
          <LinkButton to={nextHref} variant="primary" size="lg">{nextLabel}<ArrowRight size={18} aria-hidden /></LinkButton>
        </div>
        <div className="blind-result-secondary">
          <Button variant="secondary" onClick={onReplay}>{remaining ? 'Попробовать другой сценарий' : 'Сыграть случайный сценарий'}</Button>
          <div className="blind-result-share"><ShareChallengeButton payload={sharePayload} /></div>
        </div>
        <ResultNavigation />
      </section>}
    </ScenarioReplay>

    <Disclaimer>Результат описывает только эту игровую сессию и не является оценкой профессиональной квалификации.</Disclaimer>
  </div>
}

function AssetReveal({ scenario }: { scenario: BlindMarketScenario }) {
  return <section className="blind-result-market" aria-label="Раскрытый рынок">
    <div>
      <p className="blind-result-eyebrow">Вы торговали</p>
      <h2>{scenario.asset.name}</h2>
      <p>{scenario.asset.ticker} · {scenario.asset.exchange}</p>
    </div>
    <div className="blind-result-market-context">
      <p>Вы принимали решения на реальном историческом участке рынка. Цены и объёмы сохранены из исторических данных.</p>
      <div><span>Период: {scenario.reveal.period}</span><a href={scenario.sourceUrl} target="_blank" rel="noreferrer">Источник: Yahoo Finance ↗</a></div>
    </div>
  </section>
}
