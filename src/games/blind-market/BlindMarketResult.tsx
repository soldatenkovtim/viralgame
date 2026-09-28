import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  AchievementNote,
  CrowdStats,
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
import { blindMarketAchievement } from '@/lib/achievements'
import { exposureLabel, formatMoney, formatPercent, plural, pnlColor } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { BlindMarketResult as BlindResult, BlindMarketScenario } from '@/types/game'
import { infoLabels } from './InfoSelector'
import { BlindReplay } from './BlindReplay'
import { actionShortLabels } from './scoring'
import type { SaveOutcome } from '@/store/gameStore'

export function BlindMarketResult({
  scenario,
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  scenario: BlindMarketScenario
  result: BlindResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => blindMarketAchievement(result), [result])

  const timeline = useMemo<TimelineStep[]>(() => {
    const steps: TimelineStep[] = []

    result.decisions.forEach((decision, index) => {
      steps.push({
        marker: index === 0 ? 'Старт' : `Точка ${index + 1}`,
        title:
          index === 0
            ? exposureLabel(decision.exposure)
            : `${actionShortLabels[decision.action ?? 'hold']} · ${exposureLabel(decision.exposure)}`,
        detail: `Уверенность ${decision.confidence}%`,
      })

      const segmentReturn = result.segmentReturns[index]
      if (segmentReturn !== undefined) {
        steps.push({
          marker: 'Рынок',
          title: formatPercent(segmentReturn),
          tone: segmentReturn >= 0 ? 'up' : 'down',
        })
      }
    })

    steps.push({ marker: 'Финиш', title: formatPercent(result.pnlPercent) })
    return steps
  }, [result])

  const sharePayload: SharePayload = {
    t: 'blind-market',
    s: scenario.id,
    d: scenario.seed,
    r: Number(result.pnlPercent.toFixed(2)),
    a: result.decisions.map((decision, index) =>
      index === 0
        ? exposureLabel(decision.exposure)
        : actionShortLabels[decision.action ?? 'hold'],
    ),
    e: result.decisions.map((decision) => decision.exposure),
  }

  const changes = result.directionChanges

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 01 · Слепой рынок" headline="Испытание завершено">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`tnum text-3xl font-light ${pnlColor(result.pnlPercent)}`}>
            Результат: {formatPercent(result.pnlPercent)}
          </p>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <AssetReveal scenario={scenario} />

      <MetricGrid>
        <Stat
          label="Результат"
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
          label="Смена направления"
          value={`${changes} ${plural(changes, ['раз', 'раза', 'раз'])}`}
        />
        <Stat
          label="Средняя уверенность"
          value={`${Math.round(result.averageConfidence)}%`}
        />
        <Stat
          label="Открытая информация"
          value={result.selectedInformation.length}
          hint={result.selectedInformation.map((key) => infoLabels[key]).join(' · ')}
        />
        <Stat
          label="Очки испытания"
          value={outcome.points.toLocaleString('ru-RU')}
        />
      </MetricGrid>

      <PersonalBestNote
        isPersonalBest={outcome.isPersonalBest}
        pointsToBest={outcome.pointsToBest}
        points={outcome.points}
        hasPrevious={outcome.previousBest !== null}
      />

      <AchievementNote achievement={achievement} />

      <BlindReplay scenario={scenario} result={result} />

      <div className={`grid gap-6 ${scenario.crowd.length > 0 ? 'lg:grid-cols-[1fr_1fr]' : ''}`}>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-6">
          <h3 className="mb-6 text-lg font-normal tracking-tight text-chalk-50">
            Как развивалась сессия
          </h3>
          <DecisionTimeline steps={timeline} />
        </div>

        <div className="flex flex-col gap-6">
          {scenario.crowd.length > 0 && <CrowdStats title="На второй точке:" items={scenario.crowd} />}
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

function AssetReveal({ scenario }: { scenario: BlindMarketScenario }) {
  const { asset, reveal, info } = scenario

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-violet-accent/40 bg-violet-accent/5 p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10 sm:p-8">
      <div className="flex shrink-0 flex-col gap-2">
        <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
          Ты торговал
        </span>
        <span className="text-3xl font-light tracking-[-0.02em] text-chalk-50 sm:text-4xl">
          {asset.name}
        </span>
        <span className="tnum text-sm text-chalk-400">
          {asset.ticker} · {asset.exchange} · {info.sector}
        </span>
      </div>

      <div className="flex max-w-xl flex-col gap-2">
        <h3 className="text-lg font-normal tracking-tight text-chalk-50">{reveal.title}</h3>
        <p className="text-sm leading-relaxed text-chalk-400">{reveal.description}</p>
      </div>
    </section>
  )
}
