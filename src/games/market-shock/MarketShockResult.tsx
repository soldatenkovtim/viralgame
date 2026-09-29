import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  AchievementNote,
  DecisionTimeline,
  MetricGrid,
  PersonalBestNote,
  ProfileProgressBlock,
  ResultHeader,
  type TimelineStep,
} from '@/components/results/ResultBlocks'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { marketShockAchievement } from '@/lib/achievements'
import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatSeconds,
  plural,
  pnlColor,
} from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { MarketShockResult as ShockResult, MarketShockScenario } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import {
  actionLabels,
  actionPastLabels,
  initialExposure,
  PHASE_TITLES,
  positionLabel,
  SHOCK_ACTIONS,
  simulateShock,
} from './engine'
import { MarketShockReplay } from './MarketShockReplay'
import { marketShockInsights } from './scoring'

export function MarketShockResult({
  scenario,
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  scenario: MarketShockScenario
  result: ShockResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => marketShockAchievement(result), [result])
  const insights = useMemo(() => marketShockInsights(result, scenario), [result, scenario])
  const startPnl = useMemo(() => simulateShock(scenario, [], scenario.initialVisibleIndex - 1).pnlPercent, [scenario])

  const timeline = useMemo<TimelineStep[]>(() => {
    const steps: TimelineStep[] = [
      {
        marker: 'Старт',
        title: `ENTRY ${positionLabel(initialExposure(scenario))} @ ${formatPrice(scenario.initialPosition.entryPrice)}`,
        detail: `PnL на старте ${formatPercent(startPnl)}`,
      },
    ]
    result.decisions.forEach((decision) => {
      const changed = decision.positionAfter !== decision.positionBefore
      steps.push({
        marker: `Решение ${decision.phase}`,
        title: changed
          ? `${actionPastLabels[decision.action]} · ${positionLabel(decision.positionBefore)} → ${positionLabel(decision.positionAfter)}`
          : `${actionPastLabels[decision.action]} · ${positionLabel(decision.positionAfter)}`,
        detail: [
          `Цена ${formatPrice(decision.price)}`,
          `PnL ${formatPercent(decision.pnlBefore)} → ${formatPercent(decision.pnlAfter ?? result.pnlPercent)}`,
          decision.timedOut ? 'позиция оставлена без изменений по таймеру' : formatSeconds(decision.decisionTimeMs),
        ].join(' · '),
        tone: (decision.pnlAfter ?? 0) >= decision.pnlBefore ? 'up' : 'down',
      })
    })
    steps.push({
      marker: 'Итог',
      title: formatPercent(result.pnlPercent),
      tone: result.pnlPercent >= 0 ? 'up' : 'down',
    })
    return steps
  }, [result, scenario, startPnl])

  const sharePayload: SharePayload = {
    t: 'black-swan',
    s: scenario.id,
    d: scenario.seed,
    r: Number(result.pnlPercent.toFixed(2)),
    a: result.decisions.map((decision) => actionPastLabels[decision.action]),
    e: result.decisions.map((decision) => decision.positionAfter),
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 03 · Рыночный шок" headline="Сценарий завершён">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className={`tnum text-3xl font-light ${pnlColor(result.pnlPercent)}`}>
              Итоговый результат: {formatPercent(result.pnlPercent)}
            </p>
            <p className="text-sm text-chalk-400">
              {scenario.revealAsset} · {scenario.revealPeriod} · {scenario.revealEvent}
            </p>
          </div>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <MetricGrid>
        <Stat
          label="Итоговый результат"
          value={formatPercent(result.pnlPercent)}
          valueClassName={pnlColor(result.pnlPercent)}
          hint={formatMoney(result.pnl)}
        />
        <Stat
          label="Максимальная просадка"
          value={formatPercent(-result.maxDrawdown)}
          valueClassName="text-chalk-200"
        />
        <Stat label="Максимальная экспозиция" value={`${Math.round(result.maxExposure * 100)}%`} />
        <Stat label="Минимальная экспозиция" value={`${Math.round(result.minExposure * 100)}%`} />
        <Stat
          label="Изменений позиции"
          value={`${result.positionChanges} ${plural(result.positionChanges, ['раз', 'раза', 'раз'])}`}
        />
        <Stat label="Среднее время решения" value={formatSeconds(result.averageDecisionMs)} />
      </MetricGrid>

      <div className="flex flex-col gap-3">
        <PersonalBestNote
          isPersonalBest={outcome.isPersonalBest}
          pointsToBest={outcome.pointsToBest}
          points={outcome.points}
          hasPrevious={outcome.previousBest !== null}
        />
        <AchievementNote achievement={achievement} />
      </div>

      <MarketShockReplay scenario={scenario} result={result} />

      {insights.length ? (
        <section className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-6">
          <h3 className="text-lg font-normal tracking-tight text-chalk-50">Наблюдения</h3>
          <ul className="flex flex-col gap-2">
            {insights.map((insight) => (
              <li key={insight} className="text-sm leading-relaxed text-chalk-200">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-6">
          <h3 className="mb-6 text-lg font-normal tracking-tight text-chalk-50">
            История решений
          </h3>
          <DecisionTimeline steps={timeline} />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
          <span className="text-[11px] tracking-[0.18em] text-violet-soft uppercase">
            Что это было
          </span>
          <h3 className="text-2xl font-light tracking-tight text-chalk-50 sm:text-3xl">
            {scenario.revealAsset}
          </h3>
          <p className="text-sm text-chalk-200">
            {scenario.revealPeriod} · {scenario.revealEvent}
          </p>
          <p className="text-sm leading-relaxed text-chalk-400">{scenario.revealDescription}</p>
          {!scenario.synthetic ? (
            <p className="mt-2 text-xs leading-relaxed text-chalk-500">
              Рыночные данные основаны на реальном историческом движении актива. Базовые свечи — {scenario.baseTimeframe === '15m' ? '15 минут' : '1 день'}; старшие свечи агрегированы.
              {' '}<a className="text-violet-soft" href={scenario.sourceUrl} target="_blank" rel="noreferrer">Источник: Yahoo Finance</a>
            </p>
          ) : null}
        </div>
      </div>

      {scenario.crowd.length > 0 && <CrowdByPhase scenario={scenario} result={result} />}

      <div className="flex flex-col gap-6 border-t border-ink-800 pt-10">
        <ShareChallengeButton payload={sharePayload} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Disclaimer>
            Результат описывает только эту игровую сессию и не является оценкой
            профессиональной квалификации.
          </Disclaimer>
          <LinkButton to={nextHref} variant="primary" size="lg">
            {nextLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        </div>
      </div>
    </div>
  )
}

function CrowdByPhase({
  scenario,
  result,
}: {
  scenario: MarketShockScenario
  result: ShockResult
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-normal tracking-tight text-chalk-50">Как действовали другие</h3>
        <p className="text-xs text-chalk-500">Данные других игроков в прототипе смоделированы.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {scenario.crowd.map((crowd, index) => {
          const mine = result.decisions[index]?.action
          return (
            <div key={index} className="flex flex-col gap-3">
              <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
                Фаза {index + 1} · {PHASE_TITLES[index]}
              </span>
              {SHOCK_ACTIONS.map((action) => {
                const own = action === mine
                return (
                  <div key={action} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className={own ? 'text-chalk-50' : 'text-chalk-400'}>
                        {actionLabels[action]}
                        {own ? <span className="ml-2 text-xs text-violet-soft">ты</span> : null}
                      </span>
                      <span className="tnum text-chalk-200">{crowd[action]}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={`h-full rounded-full ${own ? 'bg-violet-accent' : 'bg-chalk-500/60'}`}
                        style={{ width: `${crowd[action]}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
