import { useMemo } from 'react'
import { ArrowRight, Eye } from 'lucide-react'
import {
  AchievementNote,
  MetricGrid,
  PersonalBestNote,
  ProfileProgressBlock,
  ResultHeader,
} from '@/components/results/ResultBlocks'
import { ShareChallengeButton } from '@/components/share/ShareChallengeButton'
import { LinkButton } from '@/components/ui/Button'
import { Disclaimer, Stat } from '@/components/ui/Card'
import { botTypeExplanation, botTypeReveal } from '@/data/marketMakerScenarios'
import { marketMakerAchievement } from '@/lib/achievements'
import { formatMoney, formatNumber, formatPrice, formatSigned, pnlColor } from '@/lib/formatting'
import type { SharePayload } from '@/lib/sharing'
import type { MarketMakerResult as MMResult } from '@/types/game'
import type { SaveOutcome } from '@/store/gameStore'
import { marketMakerNarrative } from './scoring'

export function MarketMakerResult({
  result,
  outcome,
  nextHref,
  nextLabel,
}: {
  result: MMResult
  outcome: SaveOutcome
  nextHref: string
  nextLabel: string
}) {
  const achievement = useMemo(() => marketMakerAchievement(result), [result])
  const narrative = marketMakerNarrative(result)

  const sharePayload: SharePayload = {
    t: 'market-maker',
    s: result.scenarioId,
    d: result.seed,
    r: Number(result.pnl.toFixed(0)),
    a: [
      `Спред ${formatPrice(result.averageSpread)}`,
      `Инвентарь до ${result.maxInventory}`,
      `Хедж ${result.hedgeCount}`,
    ],
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-14 sm:px-8 sm:py-20">
      <ResultHeader eyebrow="Испытание 02 · Маркет-мейкер" headline="Рынок закрыт">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`tnum text-3xl font-light ${pnlColor(result.pnl)}`}>
            PnL: {formatMoney(result.pnl)}
          </p>
          <ProfileProgressBlock />
        </div>
      </ResultHeader>

      <MetricGrid>
        <Stat
          label="PnL"
          value={formatMoney(result.pnl)}
          valueClassName={pnlColor(result.pnl)}
        />
        <Stat label="Максимальный inventory" value={formatNumber(result.maxInventory)} />
        <Stat label="Количество сделок" value={formatNumber(result.tradeCount)} />
        <Stat label="Средний спред" value={formatPrice(result.averageSpread)} />
        <Stat
          label="Убыток от adverse selection"
          value={`−${formatNumber(result.adverseSelectionLoss, 0)}`}
          valueClassName="text-chalk-200"
        />
        <Stat label="Хедж использован" value={formatNumber(result.hedgeCount)} />
        <Stat
          label="Инвентарь на закрытии"
          value={formatSigned(result.finalInventory)}
        />
        <Stat
          label="Спред: начало → конец"
          value={`${formatPrice(result.spreadFirstHalf)} → ${formatPrice(result.spreadSecondHalf)}`}
          valueClassName="text-xl"
        />
        <Stat label="Очки испытания" value={formatNumber(outcome.points)} />
      </MetricGrid>

      <PersonalBestNote
        isPersonalBest={outcome.isPersonalBest}
        pointsToBest={outcome.pointsToBest}
        points={outcome.points}
        hasPrevious={outcome.previousBest !== null}
      />

      <section className="flex flex-col gap-5 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-violet-soft" aria-hidden />
          <span className="text-[11px] tracking-[0.18em] text-violet-soft uppercase">
            Кто был по другую сторону
          </span>
        </div>
        <h2 className="text-2xl font-light tracking-tight text-chalk-50 sm:text-3xl">
          {botTypeReveal[result.botType]}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-chalk-400">
          {botTypeExplanation[result.botType]}
        </p>
      </section>

      <section className="rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
        <h3 className="mb-3 text-lg font-normal tracking-tight text-chalk-50">
          Как прошёл раунд
        </h3>
        <p className="max-w-2xl text-base leading-relaxed text-chalk-200">{narrative}</p>
      </section>

      <AchievementNote achievement={achievement} />

      <div className="flex flex-col gap-6 border-t border-ink-800 pt-10">
        <ShareChallengeButton payload={sharePayload} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Disclaimer>
            Поведение ботов смоделировано для прототипа и не воспроизводит реальный
            рыночный поток.
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
