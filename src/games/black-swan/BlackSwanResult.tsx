import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { ShockChart, type ShockMarker } from '@/components/charts/ShockChart'
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
import { blackSwanAchievement } from '@/lib/achievements'
import {
  exposureLabel,
  formatMoney,
  formatPercent,
  formatSeconds,
  plural,
  pnlColor,
} from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { BlackSwanResult as SwanResult, BlackSwanScenario } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import { buildShockPath } from './path'
import { actionShortLabels } from './scoring'

export function BlackSwanResult({
  scenario,
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  scenario: BlackSwanScenario
  result: SwanResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => blackSwanAchievement(result), [result])
  const path = useMemo(() => buildShockPath(scenario), [scenario])

  const markers = useMemo<ShockMarker[]>(
    () =>
      result.decisions.map((decision, index) => ({
        pointIndex: path.visibleAtDecision[index] - 1,
        label: actionShortLabels[decision.action],
      })),
    [result.decisions, path.visibleAtDecision],
  )

  const timeline = useMemo<TimelineStep[]>(() => {
    const steps: TimelineStep[] = [
      {
        marker: 'До шока',
        title: `LONG ${Math.round(scenario.initialPosition * 100)}%`,
        detail: `Исходный результат ${formatPercent(scenario.initialPnl)}`,
      },
    ]

    scenario.phases.forEach((phase, index) => {
      const decision = result.decisions[index]
      steps.push({
        marker: index === scenario.phases.length - 1 ? 'Развитие' : `Шок №${index + 1}`,
        title: formatPercent(phase.priceChange),
        tone: phase.priceChange >= 0 ? 'up' : 'down',
      })

      if (decision) {
        steps.push({
          marker: 'Ты',
          title: `${actionShortLabels[decision.action]} · ${exposureLabel(decision.exposureAfter)}`,
          detail: decision.timedOut
            ? 'Решение принято автоматически по таймеру'
            : formatSeconds(decision.timeMs),
        })
      }
    })

    return steps
  }, [scenario, result.decisions])

  const sharePayload: SharePayload = {
    t: 'black-swan',
    s: scenario.id,
    d: scenario.seed,
    r: Number(result.pnlPercent.toFixed(2)),
    a: result.decisions.map((decision) => actionShortLabels[decision.action]),
    e: result.decisions.map((decision) => decision.exposureAfter),
  }

  const averageTime =
    result.timeToDecision.reduce((sum, value) => sum + value, 0) /
    Math.max(1, result.timeToDecision.length)

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 03 · Рыночный шок" headline="Испытание завершено">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`tnum text-3xl font-light ${pnlColor(result.pnlPercent)}`}>
            Итоговый PnL: {formatPercent(result.pnlPercent)}
          </p>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <MetricGrid>
        <Stat
          label="Итоговый PnL"
          value={formatPercent(result.pnlPercent)}
          valueClassName={pnlColor(result.pnlPercent)}
          hint={formatMoney(result.pnl)}
        />
        <Stat
          label="Максимальная просадка"
          value={formatPercent(-result.maxDrawdown)}
          valueClassName="text-chalk-200"
        />
        <Stat
          label="Максимальная экспозиция"
          value={`${Math.round(result.maxExposure * 100)}%`}
        />
        <Stat
          label="Изменений позиции"
          value={`${result.positionChanges} ${plural(result.positionChanges, ['раз', 'раза', 'раз'])}`}
        />
        <Stat label="Среднее время решения" value={formatSeconds(averageTime)} />
        <Stat label="Очки испытания" value={outcome.points.toLocaleString('ru-RU')} />
      </MetricGrid>

      <PersonalBestNote
        isPersonalBest={outcome.isPersonalBest}
        pointsToBest={outcome.pointsToBest}
        points={outcome.points}
        hasPrevious={outcome.previousBest !== null}
      />

      <AchievementNote achievement={achievement} />

      <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 sm:p-6">
        <ShockChart
          points={path.points}
          visibleCount={path.points.length}
          markers={markers}
          height={280}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-6">
          <h3 className="mb-6 text-lg font-normal tracking-tight text-chalk-50">
            Как развивалась сессия
          </h3>
          <DecisionTimeline steps={timeline} />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
          <span className="text-[11px] tracking-[0.18em] text-violet-soft uppercase">
            Что это было
          </span>
          <h3 className="text-2xl font-light tracking-tight text-chalk-50 sm:text-3xl">
            {scenario.titleAfterReveal}
          </h3>
          <p className="text-sm leading-relaxed text-chalk-400">
            {scenario.revealDescription}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-chalk-500">
            Рыночные данные в прототипе стилизованы и используются исключительно для
            тестирования игровой механики.
          </p>
        </div>
      </div>

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
