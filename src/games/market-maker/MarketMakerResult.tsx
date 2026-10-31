import { useMemo, type CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { QuoteChart, QuoteLegend } from '@/components/charts/QuoteChart'
import { PersonalBestNote } from '@/components/results/ResultBlocks'
import { ScenarioReplay } from '@/components/results/ScenarioReplay'
import { ResultNavigation } from '@/components/results/ResultNavigation'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { Button, LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { flowRegimeLabels } from '@/data/marketMakerScenarios'
import { formatNumber, formatPrice, formatSigned, pnlColor, plural } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { MarketMakerResult as MMResult, MMPhaseStats } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import { AccountingDebug } from './AccountingDebug'
import { tickToSeconds } from './market'
import '../blind-market/BlindMarketResult.css'
import './MarketMakerResult.css'

import { financialNumber as money, roundObservation, phaseComment, phaseReconciliation } from './resultAnalysis'

export function MarketMakerResult({ result, outcome, nextHref, nextLabel }: {
  result: MMResult; outcome: SaveOutcome; nextHref: string; nextLabel: string
}) {
  const sharePayload: SharePayload = { t: 'market-maker', s: result.scenarioId, d: result.seed, r: Number(result.pnl.toFixed(0)), a: [`Спред ${money(result.spreadPnl)}`, `Инвентарь до ${result.maxInventory}`, `Хедж ${result.hedgeCount}`] }
  const duration = result.timeline?.length ? tickToSeconds(result.timeline.at(-1)!.tick) : result.phases?.at(-1)?.to
  return <div className="blind-result mm-result">
    <header className="blind-result-header">
      <p className="blind-result-eyebrow">Испытание 02 · Маркет-мейкер</p>
      <h1>Испытание завершено.</h1>
      <p className={`blind-result-headline tnum ${pnlColor(Math.round(result.pnl * 100) / 100)}`}>PnL: {money(result.pnl)}</p>
      <p className="mm-result-caption">Раунд завершён{duration !== undefined ? ` · ${formatNumber(duration)} ${plural(duration, ['секунда', 'секунды', 'секунд'])}` : ''}</p>
    </header>
    <section className="blind-result-summary" aria-label="Итоги прохождения">
      <div className="blind-result-metrics">
        <Stat label="Очки испытания" value={formatNumber(outcome.points)} />
        <Stat label="Количество сделок" value={formatNumber(result.tradeCount)} />
        <Stat label="Средний спред" value={formatPrice(result.averageSpread)} />
        <Stat label="Максимальный инвентарь" value={`${formatNumber(result.maxInventory)} ${plural(result.maxInventory, ['лот', 'лота', 'лотов'])}`} />
        <Stat label="Хеджирований" value={formatNumber(result.hedgeCount)} />
        <Stat label="Время выше мягкого лимита" value={`${formatNumber(result.secondsAboveSoftLimit)} с`} />
      </div>
      {outcome.previousBest !== null && <div className="blind-result-notes"><PersonalBestNote isPersonalBest={outcome.isPersonalBest} pointsToBest={outcome.pointsToBest} points={outcome.points} hasPrevious /></div>}
    </section>
    <PnlBreakdown result={result} />
    <FairValueReplay result={result} />
    <section className="mm-result-observation"><h2>Главное наблюдение</h2><p>{roundObservation(result)}</p></section>
    <ScenarioReplay challengeType="market-maker" scenarioId={result.scenarioId}>
      {({completed, total, remaining, onReplay}) => <section className="blind-result-next">
        <div className="blind-result-next-primary"><div><h2>Что дальше</h2><p>Вы прошли {completed} из {total} сценариев этого испытания. {remaining ? `Доступно ещё ${remaining} ${plural(remaining, ['сценарий', 'сценария', 'сценариев'])}.` : 'Все сценарии этого испытания пройдены.'}</p></div>
          <LinkButton to={nextHref} variant="primary" size="lg">{nextLabel}<ArrowRight size={18} aria-hidden /></LinkButton></div>
        <div className="blind-result-secondary"><Button variant="secondary" onClick={onReplay}>{remaining ? 'Попробовать другой сценарий' : 'Сыграть случайный сценарий'}</Button><div className="blind-result-share"><ShareChallengeButton payload={sharePayload} /></div></div>
        <ResultNavigation />
      </section>}
    </ScenarioReplay>
    <Disclaimer>Поток заявок и справедливая цена смоделированы и не воспроизводят реальный рынок.</Disclaimer>
    {import.meta.env.DEV && import.meta.env.VITE_MM_ACCOUNTING_DEBUG === 'true' && result.accounting && <AccountingDebug data={result.accounting} />}
  </div>
}

export function PnlBreakdown({ result }: { result: MMResult }) {
  const rows = [
    { label: 'Исполнение относительно рынка', value: result.spreadPnl },
    { label: 'Переоценка инвентаря', value: result.inventoryPnl },
    { label: 'Хеджирование', value: -result.hedgeCosts },
    { label: 'Комиссии', value: -(result.transactionCosts ?? 0) },
    ...(result.carryCosts ? [{ label: 'Удержание позиции', value: -result.carryCosts }] : []),
  ]
  return <section className="mm-result-pnl">
    <h2>Из чего сложился PnL</h2>
    <dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd className={`tnum ${pnlColor(Math.round(row.value * 100) / 100)}`}>{money(row.value)}</dd></div>)}
      <div className="mm-result-total"><dt>Итого</dt><dd className={`tnum ${pnlColor(Math.round(result.pnl * 100) / 100)}`}>{money(result.pnl)}</dd></div>
    </dl>
    <details><summary>Подробнее о расчёте PnL</summary>
      <p>Инвентарь на закрытии: {formatSigned(result.finalInventory)}. Открытая позиция оценена по последней рыночной цене. Исполнение отражает разницу цены сделки и рынка; переоценка — последующее движение цены по позициям раунда.</p>
      {result.realizedPnl !== undefined && result.unrealizedPnl !== undefined ? <>
        <dl><div><dt>Реализованный результат · до издержек</dt><dd>{money(result.realizedPnl)}</dd></div><div><dt>Нереализованный результат</dt><dd>{money(result.unrealizedPnl)}</dd></div><div><dt>Издержки</dt><dd>{money(-(result.hedgeCosts + (result.transactionCosts ?? 0) + (result.carryCosts ?? 0)))}</dd></div></dl>
        <p>Это альтернативная разбивка того же PnL: реализованный + нереализованный результат − издержки. Её значения не прибавляются к компонентам выше. Отображаемые суммы округлены до сотых игровых единиц; расчёты используют исходную точность.</p>
      </> : <p>Альтернативная разбивка для этого прохождения не сохранена.</p>}
    </details>
  </section>
}

function FairValueReplay({ result }: { result: MMResult }) {
  const timeline = result.timeline
  const informedTicks = useMemo(() => {
    const ticks = new Set<number>()
    if (!timeline) return ticks
    for (const point of timeline) {
      const second = tickToSeconds(point.tick)
      const informed = (result.phases ?? []).some(
        (phase) => phase.regime === 'informed' && second >= phase.from && second < phase.to,
      )
      if (informed) ticks.add(point.tick)
    }
    return ticks
  }, [timeline, result.phases])

  return (
    <section className="mm-result-replay">
      <h2>Что происходило на рынке</h2>
      <p className="mm-result-caption">Во время раунда справедливая цена была скрыта. Фиолетовая линия раскрывает её движение, а жёлтая полоса отмечает существенное отклонение ваших котировок от неё.</p>

      {timeline && timeline.length > 1 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
          <QuoteChart
            points={timeline}
            trades={result.trades ?? []}
            totalTicks={timeline[timeline.length - 1].tick}
            informedTicks={informedTicks}
            height={340}
            showTimeAxis
          />
          <QuoteLegend replay showInformed={informedTicks.size > 0} />
        </div>
      ) : <p className="mm-result-caption">Для этого прохождения график не сохранён.</p>}

      <PhaseStrip phases={result.phases ?? []} />
      {phaseReconciliation(result) && <p className="mm-result-caption">{phaseReconciliation(result)}</p>}
    </section>
  )
}

function PhaseStrip({ phases }: { phases: MMPhaseStats[] }) {
  if (!phases.length) return <p className="mm-result-caption">Данные фаз для этого прохождения не сохранены.</p>
  return (
    <div>
      <div className="mm-phase-grid" data-single={phases.length === 1} style={{ '--phase-columns': Math.min(phases.length, 3) } as CSSProperties}>
        {phases.map((phase, index) => (
          <div
            key={`${phase.regime}-${phase.from}-stats`}
            className="mm-phase-card flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-4"
          >
            <div className="mm-phase-description flex min-w-0 flex-col gap-2">
            <p className="blind-result-eyebrow">Фаза {String(index + 1).padStart(2, '0')}</p>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-sm text-chalk-50">{flowRegimeLabels[phase.regime]}</span>
              <span className="tnum text-xs text-chalk-500">
                {phase.from}–{phase.to} с
              </span>
            </div>
            <p className="text-xs leading-relaxed text-chalk-400">
              {phaseComment(phase)}
            </p>
            </div>
            <dl className="tnum mt-1 grid grid-cols-3 gap-2 text-xs">
              <PhaseFigure label="Сделок" value={formatNumber(phase.fills)} />
              <PhaseFigure label="Спред" value={formatPrice(phase.averageSpread)} />
              <PhaseFigure
                label="PnL"
                value={money(phase.pnlChange)}
                className={pnlColor(Math.round(phase.pnlChange * 100) / 100)}
              />
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

function PhaseFigure({
  label,
  value,
  className = 'text-chalk-200',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-chalk-500">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  )
}
