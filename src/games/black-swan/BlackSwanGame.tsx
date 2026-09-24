import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { ShockChart, type ShockMarker } from '@/components/charts/ShockChart'
import { Button } from '@/components/ui/Button'
import { ChoiceButton } from '@/components/ui/ChoiceButton'
import { SectionLabel } from '@/components/ui/Card'
import { BLACK_SWAN_DECISION_SECONDS } from '@/data/blackSwanScenarios'
import { useCountdown } from '@/hooks/useCountdown'
import { useReveal } from '@/hooks/useReveal'
import { CAPITAL } from '@/lib/constants'
import { exposureLabel, formatPercent, formatSigned, pnlColor } from '@/lib/formatting'
import type {
  BlackSwanAction,
  BlackSwanDecision,
  BlackSwanResult,
  BlackSwanScenario,
} from '@/types/game'
import { buildShockPath, SHOCK_HISTORY_POINTS } from './path'
import {
  actionLabels,
  applyBlackSwanAction,
  BLACK_SWAN_ACTIONS,
  computeBlackSwan,
  computeRevealedPnl,
} from './scoring'

type Stage = 'intro' | 'shock' | 'decision' | 'resolving' | 'finished'

export function BlackSwanGame({
  scenario,
  timerDisabled = false,
  onComplete,
}: {
  scenario: BlackSwanScenario
  timerDisabled?: boolean
  onComplete: (result: BlackSwanResult) => void
}) {
  const path = useMemo(() => buildShockPath(scenario), [scenario])

  const [stage, setStage] = useState<Stage>('intro')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [decisions, setDecisions] = useState<BlackSwanDecision[]>([])
  const [selected, setSelected] = useState<BlackSwanAction | null>(null)

  const { visible, revealTo, reset } = useReveal(SHOCK_HISTORY_POINTS, 55)
  const decisionStartRef = useRef(Date.now())

  const exposure = decisions.at(-1)?.exposureAfter ?? scenario.initialPosition
  const phase = scenario.phases[phaseIndex]

  useEffect(() => {
    setStage('intro')
    setPhaseIndex(0)
    setDecisions([])
    setSelected(null)
    reset(SHOCK_HISTORY_POINTS)
  }, [scenario, reset])

  /** Рынок двигается первым: игрок отвечает уже на случившееся движение. */
  const playShock = useCallback(
    (index: number) => {
      setStage('shock')
      revealTo(path.visibleAtDecision[index], () => {
        decisionStartRef.current = Date.now()
        setStage('decision')
      })
    },
    [path, revealTo],
  )

  const commit = useCallback(
    (action: BlackSwanAction, timedOut: boolean) => {
      const exposureBefore = decisions.at(-1)?.exposureAfter ?? scenario.initialPosition
      const decision: BlackSwanDecision = {
        phaseIndex,
        action,
        exposureBefore,
        exposureAfter: applyBlackSwanAction(exposureBefore, action),
        timeMs: Date.now() - decisionStartRef.current,
        timedOut,
      }

      const nextDecisions = [...decisions, decision]
      setDecisions(nextDecisions)
      setSelected(null)
      setStage('resolving')

      const isLast = phaseIndex === scenario.phases.length - 1

      revealTo(path.visibleAfterPhase[phaseIndex], () => {
        if (isLast) {
          setStage('finished')
          onComplete(buildResult(scenario, nextDecisions))
          return
        }
        const next = phaseIndex + 1
        setPhaseIndex(next)
        playShock(next)
      })
    },
    [decisions, onComplete, path, phaseIndex, playShock, revealTo, scenario],
  )

  const { remaining } = useCountdown({
    seconds: BLACK_SWAN_DECISION_SECONDS,
    active: stage === 'decision',
    disabled: timerDisabled,
    resetKey: `${scenario.id}-${phaseIndex}`,
    // Если время вышло, позиция просто остаётся как есть. Это не проигрыш.
    onExpire: () => commit('hold', true),
  })

  const markers = useMemo<ShockMarker[]>(
    () =>
      decisions.map((decision, index) => ({
        pointIndex: path.visibleAtDecision[index] - 1,
        label: exposureLabel(decision.exposureAfter),
      })),
    [decisions, path.visibleAtDecision],
  )

  // Живой PnL считается по уже раскрытой части траектории, а не по фазам целиком.
  const runningPnl = useMemo(
    () => computeRevealedPnl(scenario, decisions, path, visible),
    [scenario, decisions, path, visible],
  )

  if (stage === 'intro') {
    return <Intro scenario={scenario} onStart={() => playShock(0)} />
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <span className="tnum text-sm text-chalk-500">
              Фаза {phaseIndex + 1} из {scenario.phases.length}
            </span>
            {stage === 'decision' && !timerDisabled ? (
              <Countdown remaining={remaining} />
            ) : null}
          </header>

          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span className="tnum text-2xl font-light text-chalk-50">
                {path.points[visible - 1]?.toFixed(2)}
              </span>
              <span className={`tnum text-sm ${pnlColor(runningPnl)}`}>
                {formatPercent((runningPnl / CAPITAL) * 100)}
              </span>
            </div>
            <ShockChart points={path.points} visibleCount={visible} markers={markers} />
          </div>

          <MarketConditions phase={phase} phaseIndex={phaseIndex} />
        </div>

        <aside className="flex flex-col gap-5">
          <PortfolioPanel exposure={exposure} pnl={runningPnl} />

          {stage === 'shock' || stage === 'resolving' ? (
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-6">
              <p className="text-sm text-chalk-400">
                {stage === 'shock'
                  ? 'Рынок двигается…'
                  : 'Рынок отыгрывает движение…'}
              </p>
            </div>
          ) : stage === 'decision' ? (
            <div className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:p-6">
              <h2 className="text-xl font-normal tracking-tight text-chalk-50">
                Что делать с позицией?
              </h2>

              <div className="grid gap-2.5">
                {BLACK_SWAN_ACTIONS.map((action) => (
                  <ChoiceButton
                    key={action}
                    label={actionLabels[action]}
                    hint={`Станет: ${exposureLabel(applyBlackSwanAction(exposure, action))}`}
                    selected={selected === action}
                    onClick={() => setSelected(action)}
                  />
                ))}
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!selected}
                onClick={() => selected && commit(selected, false)}
              >
                Подтвердить решение
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function Intro({
  scenario,
  onStart,
}: {
  scenario: BlackSwanScenario
  onStart: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 03</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Рыночный шок
        </h1>
      </div>

      <p className="text-base leading-relaxed text-chalk-200">
        Ты уже в позиции — её выбрал не ты. Тебе передали портфель и контекст.
        Дальше рынок будет меняться, а решение придётся принимать за ограниченное
        время.
      </p>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl border border-ink-700 bg-ink-900 p-6">
        <Field label="Капитал" value={CAPITAL.toLocaleString('ru-RU')} />
        <Field
          label="Позиция"
          value={`LONG ${Math.round(scenario.initialPosition * 100)}%`}
        />
        <Field
          label="PnL"
          value={formatPercent(scenario.initialPnl)}
          valueClass="text-market-up"
        />
        <Field label="Волатильность" value={scenario.contextVolatility} />
      </dl>

      <p className="text-xs leading-relaxed text-chalk-500">
        На каждое решение даётся {BLACK_SWAN_DECISION_SECONDS} секунд. Если время
        закончится, позиция останется без изменений — это не проигрыш.
      </p>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Принять портфель
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function Field({
  label,
  value,
  valueClass = 'text-chalk-50',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">{label}</dt>
      <dd className={`tnum text-lg font-light ${valueClass}`}>{value}</dd>
    </div>
  )
}

function Countdown({ remaining }: { remaining: number }) {
  const urgent = remaining <= 5

  return (
    <div className="flex items-center gap-3">
      <span
        className={`tnum text-sm ${urgent ? 'text-market-down' : 'text-chalk-400'}`}
      >
        {remaining} с
      </span>
      <div className="h-0.5 w-24 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            urgent ? 'bg-market-down' : 'bg-chalk-500'
          }`}
          style={{ width: `${(remaining / 20) * 100}%` }}
        />
      </div>
    </div>
  )
}

function PortfolioPanel({ exposure, pnl }: { exposure: number; pnl: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
          Позиция
        </span>
        <span className="text-base text-chalk-50">{exposureLabel(exposure)}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
          PnL
        </span>
        <span className={`tnum text-base ${pnlColor(pnl)}`}>
          {formatPercent((pnl / CAPITAL) * 100)}
        </span>
      </div>
    </div>
  )
}

function MarketConditions({
  phase,
  phaseIndex,
}: {
  phase: { volatilityChange: number; liquidityChange: number; description: string }
  phaseIndex: number
}) {
  const severe = phase.volatilityChange >= 150

  return (
    <div
      className={`flex animate-fade flex-col gap-4 rounded-xl border p-5 sm:p-6 ${
        severe
          ? 'border-market-down/35 bg-market-down/6'
          : 'border-ink-700 bg-ink-900'
      }`}
    >
      <div className="flex items-center gap-3">
        {severe ? (
          <TriangleAlert className="h-4 w-4 text-market-down" aria-hidden />
        ) : null}
        <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">
          {phaseIndex === 0 ? 'Состояние рынка' : `Шок №${phaseIndex}`}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-chalk-200">{phase.description}</p>

      <div className="grid grid-cols-2 gap-6 border-t border-ink-800 pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
            Волатильность
          </span>
          <span className="tnum text-lg font-light text-chalk-50">
            {formatSigned(phase.volatilityChange)}%
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
            Ликвидность
          </span>
          <span className="tnum text-lg font-light text-chalk-50">
            {formatSigned(phase.liquidityChange)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function buildResult(
  scenario: BlackSwanScenario,
  decisions: BlackSwanDecision[],
): BlackSwanResult {
  const computation = computeBlackSwan(scenario, decisions)

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    pnl: computation.pnl,
    pnlPercent: computation.pnlPercent,
    maxDrawdown: computation.maxDrawdown,
    maxExposure: computation.maxExposure,
    positionChanges: computation.positionChanges,
    decisions,
    timeToDecision: decisions.map((decision) => decision.timeMs),
    score: computation.score,
  }
}
