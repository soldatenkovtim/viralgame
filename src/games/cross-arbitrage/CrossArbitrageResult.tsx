import { ExecutionBreakdown } from './CrossArbitrageGame'
import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  AchievementNote,
  MetricGrid,
  PersonalBestNote,
  ProfileProgressBlock,
  ResultHeader,
} from '@/components/results/ResultBlocks'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, SectionLabel, Stat } from '@/components/ui/Card'
import { getCrossArbitrageScenario } from '@/data/crossArbitrageScenarios'
import { crossArbitrageAchievement } from '@/lib/achievements'
import { formatNumber, pnlColor } from '@/lib/formatting'
import { scaleTrait, traitLabels } from '@/lib/profile'
import type { SaveOutcome } from '@/store/gameStore'
import type { CrossArbitrageResult as ArbResult, CrossArbitrageSession } from '@/types/game'
import {
  arbitrageObservations,
  buildArbitrageSharePayload,
  crossArbitrageTraits,
  formatDecisionSeconds,
  formatEdge,
  roundFeedback,
  roundShortLabel,
  routeLabel,
  sizeLabel,
  type CrossArbitrageTraits,
} from './scoring'

const PROFILE_CONTRIBUTION: { trait: keyof CrossArbitrageTraits; share: string }[] = [
  { trait: 'opportunity', share: '50%' },
  { trait: 'discipline', share: '30%' },
  { trait: 'adaptability', share: '20%' },
]

export function CrossArbitrageResult({
  session,
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  session: CrossArbitrageSession
  result: ArbResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => crossArbitrageAchievement(result), [result])
  const observations = useMemo(() => arbitrageObservations(result), [result])
  const traits = useMemo(() => crossArbitrageTraits(result), [result])

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 04 · Кросс-арбитраж" headline="Испытание завершено">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`tnum text-3xl font-light ${pnlColor(result.totalReturnPercent)}`}>
            Общий результат: {formatEdge(result.totalReturnPercent)}
          </p>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <MetricGrid>
        <Stat
          label="Общий результат"
          value={formatEdge(result.totalReturnPercent)}
          valueClassName={pnlColor(Number(result.totalReturnPercent.toFixed(2)))}
          hint="Сумма чистых результатов с учётом размера"
        />
        <Stat
          label="Найдено возможностей"
          value={`${result.found} / ${result.opportunities}`}
        />
        <Stat label="Ложных сделок" value={formatNumber(result.falseTrades)} />
        <Stat label="Пропущено сделок" value={formatNumber(result.missed)} />
        <Stat
          label="Среднее время решения"
          value={formatDecisionSeconds(result.averageDecisionMs)}
        />
        <Stat
          label="Лучший найденный edge"
          value={result.bestEdgePercent > 0 ? formatEdge(result.bestEdgePercent) : '—'}
          valueClassName={result.bestEdgePercent > 0 ? 'text-market-up' : 'text-chalk-200'}
        />
        <Stat label="Средний размер сделки" value={`${formatNumber(result.averageSizeUnits ?? 0, 1)} ед.`} />
        <Stat label="Размер ухудшил edge" value={`${result.sizeWorsenedCount ?? 0} раз`} />
      </MetricGrid>

      <PersonalBestNote
        isPersonalBest={outcome.isPersonalBest}
        pointsToBest={outcome.pointsToBest}
        points={outcome.points}
        hasPrevious={outcome.previousBest !== null}
      />

      {observations.length ? (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
          {observations.map((text) => (
            <p key={text} className="max-w-3xl text-lg leading-relaxed font-light text-chalk-50">
              {text}
            </p>
          ))}
        </div>
      ) : null}

      <AchievementNote achievement={achievement} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-normal tracking-tight text-chalk-50">Рынок за рынком</h2>
        <ol className="flex flex-col gap-3">
          {result.rounds.map((round, index) => {
            const scenario = getCrossArbitrageScenario(round.scenarioId)
            const feedback = roundFeedback(round, scenario)
            return (
              <li
                key={round.scenarioId}
                className="grid gap-4 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:grid-cols-[180px_1fr_auto] sm:items-start"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
                    Рынок {index + 1}
                  </span>
                  <span className="text-base text-chalk-50">{scenario.asset}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-base text-chalk-50">{roundShortLabel(round)}</span>
                  <span className="text-sm text-chalk-200">{feedback.title}</span>
                  {round.optimalNetReturn > 0 ? (
                    <span className="tnum text-xs text-chalk-500">
                      Лучший вариант на старте: {routeLabel(scenario, round.optimalBuyVenue, round.optimalSellVenue)}{' '}
                      · {sizeLabel(round.optimalPositionSize ?? 1)} · {formatEdge(round.optimalNetReturn * 100)}
                    </span>
                  ) : null}
                  <ExecutionBreakdown round={round} />
                  {scenario.revealText ? (
                    <span className="text-xs leading-relaxed text-chalk-500">
                      {scenario.revealText}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <span
                    className={`tnum text-xl font-light ${pnlColor(Number(feedback.valuePercent.toFixed(2)))}`}
                  >
                    {formatEdge(feedback.valuePercent)}
                  </span>
                  <span className="tnum text-xs text-chalk-500">
                    {formatDecisionSeconds(round.decisionTimeMs)}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="grid gap-8 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-3">
          <SectionLabel>Вклад в Trading Profile</SectionLabel>
          <p className="text-sm leading-relaxed text-chalk-400">
            Кросс-арбитраж добавляет в профиль новую характеристику — «Поиск
            возможностей» — и дополняет дисциплину и адаптивность. Скорость влияет
            только на адаптивность и не является главным критерием.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          {PROFILE_CONTRIBUTION.map(({ trait, share }) => {
            const value = scaleTrait(traits[trait])
            return (
              <div key={trait} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-base text-chalk-200">
                    {traitLabels[trait]}
                    <span className="ml-2 text-xs text-chalk-500">{share} вклада</span>
                  </span>
                  <span className="tnum text-2xl leading-none font-light text-chalk-50">
                    {value}
                  </span>
                </div>
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-violet-accent"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex flex-col gap-6 border-t border-ink-800 pt-10">
        <ShareChallengeButton payload={buildArbitrageSharePayload(session, result)} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Disclaimer>
            Котировки в прототипе смоделированы. Результат описывает только эту игровую
            сессию и не является оценкой профессиональной квалификации.
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
