import { difficultyFor } from '@/modes/config'
import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { ChartMarker } from '@/components/charts/CandleChart'
import { Button } from '@/components/ui/Button'
import { useCountdown } from '@/hooks/useCountdown'
import { useReveal } from '@/hooks/useReveal'
import { formatPercent, formatPrice, pnlColor } from '@/lib/formatting'
import type {
  MarketShockResult,
  MarketShockScenario,
  ShockAction,
  ShockDecision,
  UserPriceLevel,
} from '@/types/game'
import {
  applyShockAction,
  decisionCandleIndex,
  initialExposure,
  positionLabel,
  simulateShock,
} from './engine'
import { MarketShockChart } from './MarketShockChart'
import { MarketShockDecisionPanel, PositionSummary } from './MarketShockDecisionPanel'
import { MarketShockIntro } from './MarketShockIntro'
import { MarketShockMetrics } from './MarketShockMetrics'
import { buildMarketShockResult } from './scoring'

export type MarketShockStage =
  | 'intro'
  | 'context'
  | 'phase-1'
  | 'phase-2'
  | 'phase-3'
  | 'reveal'
  | 'result'

const PHASE_STAGES = ['phase-1', 'phase-2', 'phase-3'] as const

/** Скорость дорисовки: 12 свечей фазы укладываются примерно в секунду. */
const REVEAL_STEP_MS = 80

function phaseNumberOf(stage: MarketShockStage): number {
  const index = PHASE_STAGES.indexOf(stage as (typeof PHASE_STAGES)[number])
  return index + 1
}

export function MarketShockGame({
  scenario,
  timerDisabled = false,
  onComplete,
}: {
  context?: ChallengeContext
  scenario: MarketShockScenario
  timerDisabled?: boolean
  onComplete: (result: MarketShockResult) => void
}) {
  const difficulty = difficultyFor('black-swan', scenario.mode === 'advanced')
  const [stage, setStage] = useState<MarketShockStage>('intro')
  const [deciding, setDeciding] = useState(false)
  const [revealDone, setRevealDone] = useState(false)
  const [decisions, setDecisions] = useState<ShockDecision[]>([])
  const [selected, setSelected] = useState<ShockAction | null>(null)
  const [levels, setLevels] = useState<UserPriceLevel[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const decisionStartRef = useRef(0)
  /** Последняя зафиксированная фаза: таймер и клик не должны записать решение дважды. */
  const lastCommittedRef = useRef(0)

  const { visible, revealTo, reset } = useReveal(scenario.initialVisibleIndex, REVEAL_STEP_MS)

  useEffect(() => {
    setStage('intro')
    setDeciding(false)
    setRevealDone(false)
    setDecisions([])
    setSelected(null)
    setLevels([])
    setNotice(null)
    lastCommittedRef.current = 0
    reset(scenario.initialVisibleIndex)
  }, [scenario, reset])

  const phaseNumber = phaseNumberOf(stage)
  const position = decisions.at(-1)?.positionAfter ?? initialExposure(scenario)

  const simulation = useMemo(() => simulateShock(scenario, decisions), [scenario, decisions])
  const currentIndex = visible - 1
  const currentPoint =
    simulation.points.find((point) => point.index === currentIndex) ?? simulation.points[0]
  const pnlPercent = currentPoint.pnlPercent
  const price = scenario.candles[currentIndex].close

  /** Рынок двигается первым; кнопки и таймер включаются только после дорисовки. */
  const playPhase = useCallback(
    (phase: number) => {
      setStage(PHASE_STAGES[phase - 1])
      setDeciding(false)
      revealTo(scenario.phaseCheckpoints[phase - 1], () => {
        decisionStartRef.current = Date.now()
        setDeciding(true)
      })
    },
    [revealTo, scenario.phaseCheckpoints],
  )

  const commit = useCallback(
    (action: ShockAction, timedOut: boolean) => {
      const phase = phaseNumberOf(stage)
      if (!deciding || phase === 0 || position === 0 || lastCommittedRef.current >= phase) return
      lastCommittedRef.current = phase
      const before = decisions.at(-1)?.positionAfter ?? initialExposure(scenario)
      const candleIndex = decisionCandleIndex(scenario, phase)
      const decision: ShockDecision = {
        phase,
        action,
        positionBefore: before,
        positionAfter: applyShockAction(before, action),
        price: scenario.candles[candleIndex].close,
        pnlBefore: simulateShock(scenario, decisions, candleIndex).pnlPercent,
        decisionTimeMs: Date.now() - decisionStartRef.current,
        timestamp: Date.now(),
        timedOut,
      }

      setDecisions((current) => [...current, decision])
      setSelected(null)
      setDeciding(false)
      setNotice(timedOut ? 'Позиция оставлена без изменений.' : null)

      if (decision.positionAfter === 0) {
        setNotice('Позиция закрыта. Остаток сценария проигрывается без позиции.')
        setStage('reveal')
        const completedDecisions = [...decisions, decision]
        revealTo(scenario.candles.length, () => {
          setStage('result')
          onComplete(buildMarketShockResult(scenario, completedDecisions, levels))
        })
        return
      }

      if (phase < 3) {
        playPhase(phase + 1)
        return
      }

      setStage('reveal')
      revealTo(scenario.candles.length, () => setRevealDone(true))
    },
    [deciding, position, decisions, levels, onComplete, playPhase, revealTo, scenario, stage],
  )

  const { remaining } = useCountdown({
    seconds: difficulty.timerSeconds,
    active: deciding && phaseNumber > 0 && position !== 0,
    disabled: timerDisabled,
    resetKey: `${scenario.id}-${stage}`,
    onExpire: () => commit('hold', true),
  })

  const markers = useMemo<ChartMarker[]>(
    () =>
      decisions.map((decision) => ({
        candleIndex: decisionCandleIndex(scenario, decision.phase),
        position: 'aboveBar',
        shape: 'circle',
        color: '#9b84ff',
        text: positionLabel(decision.positionAfter),
      })),
    [decisions, scenario],
  )

  const finish = () => {
    const result = buildMarketShockResult(scenario, decisions, levels)
    setStage('result')
    onComplete(result)
  }

  if (stage === 'intro') {
    return (
      <MarketShockIntro
        scenario={scenario}
        pnlPercent={pnlPercent}
        onStart={() => setStage('context')}
      />
    )
  }

  const phase = phaseNumber > 0 ? scenario.phases[phaseNumber - 1] : undefined

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">
            Рыночный шок
          </span>
          <span className="text-sm text-chalk-200">{scenario.assetHiddenName}</span>
          <span className="text-xs text-chalk-500">актив скрыт до конца сценария</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="tnum text-xl font-light text-chalk-50">{formatPrice(price)}</span>
          <span className={`tnum text-sm ${pnlColor(pnlPercent)}`}>
            PnL {formatPercent(pnlPercent, 2)}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
        <MarketShockChart
          scenario={scenario}
          visibleCount={visible}
          position={position}
          levels={levels}
          onLevelsChange={setLevels}
          markers={markers}
          editable={stage !== 'reveal'}
        />

        <aside className="flex flex-col gap-4">
          {stage === 'context' ? (
            <>
              {difficulty.hintsEnabled && <MarketShockMetrics context={scenario.context} />}
              <PositionSummary
                position={position}
                pnlPercent={pnlPercent}
                entryPrice={scenario.initialPosition.entryPrice}
                price={price}
              />
              <section className="flex flex-col gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:p-5">
                <p className="text-sm leading-relaxed text-chalk-400">
                  Изучи график: переключи таймфрейм, отметь до двух уровней. Времени на этом этапе
                  нет — отсчёт начнётся с первой фазы.
                </p>
                <Button variant="primary" size="lg" fullWidth onClick={() => playPhase(1)}>
                  Начать управление позицией
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </section>
            </>
          ) : null}

          {phase ? (
            <>
              {difficulty.hintsEnabled && <MarketShockMetrics
                context={scenario.context}
                phase={phase}
                phaseNumber={phaseNumber}
                pending={!deciding}
              />}
              <PositionSummary
                position={position}
                pnlPercent={pnlPercent}
                entryPrice={scenario.initialPosition.entryPrice}
                price={price}
              />
              <MarketShockDecisionPanel
                phaseNumber={phaseNumber}
                position={position}
                deciding={deciding}
                remaining={remaining}
                totalSeconds={difficulty.timerSeconds}
                timerDisabled={timerDisabled}
                selected={selected}
                notice={notice}
                onSelect={setSelected}
                onConfirm={() => selected && commit(selected, false)}
              />
            </>
          ) : null}

          {stage === 'reveal' || stage === 'result' ? (
            <>
              <PositionSummary
                position={position}
                pnlPercent={pnlPercent}
                entryPrice={scenario.initialPosition.entryPrice}
                price={price}
              />
              {position === 0 ? (
                <p className="tnum text-sm text-chalk-400">
                  Цена выхода: {formatPrice(decisions.at(-1)!.price)} · Зафиксированный PnL: {formatPercent(pnlPercent, 2)}
                </p>
              ) : null}
              <FinalReveal
                scenario={scenario}
                ready={revealDone}
                notice={notice}
                onContinue={finish}
              />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function FinalReveal({
  scenario,
  ready,
  notice,
  onContinue,
}: {
  scenario: MarketShockScenario
  ready: boolean
  notice: string | null
  onContinue: () => void
}) {
  if (!ready) {
    return (
      <section className="rounded-xl border border-ink-700 bg-ink-900 p-5">
        {notice ? <p className="mb-2 text-xs text-chalk-400">{notice}</p> : null}
        <p className="text-sm text-chalk-400">Рынок доигрывает сценарий…</p>
      </section>
    )
  }

  return (
    <section className="flex animate-fade-up flex-col gap-4 rounded-xl border border-violet-accent/30 bg-violet-dim/20 p-5">
      <span className="text-[11px] tracking-[0.18em] text-violet-soft uppercase">
        Сценарий завершён
      </span>
      <dl className="flex flex-col gap-2 text-sm">
        <RevealRow label="Рынок" value={scenario.revealAsset} />
        <RevealRow label="Период" value={scenario.revealPeriod} />
        <RevealRow label="Контекст" value={scenario.revealEvent} />
      </dl>
      {scenario.synthetic ? (
        <p className="text-xs leading-relaxed text-chalk-500">
          {scenario.mode === 'advanced' ? 'Синтетический сценарий для проверки решений в неоднозначном рынке.' : 'Сценарий стилизован на основе реального рыночного события.'}
        </p>
      ) : null}
      <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
        Открыть разбор
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </section>
  )
}

function RevealRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-chalk-500">{label}</dt>
      <dd className="text-right text-chalk-50">{value}</dd>
    </div>
  )
}
