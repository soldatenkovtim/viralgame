import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, EyeOff } from 'lucide-react'
import { CandleChart, type ChartMarker } from '@/components/charts/CandleChart'
import { Button } from '@/components/ui/Button'
import { ChoiceButton, PillButton } from '@/components/ui/ChoiceButton'
import { ConfidenceSlider } from '@/components/ui/ConfidenceSlider'
import { SectionLabel } from '@/components/ui/Card'
import { useReveal } from '@/hooks/useReveal'
import { exposureLabel, formatMoney, formatPercent, pnlColor } from '@/lib/formatting'
import { CAPITAL } from '@/lib/constants'
import type {
  BlindDecision,
  BlindDirection,
  BlindFollowUpAction,
  BlindInfoKey,
  BlindMarketResult,
  BlindMarketScenario,
} from '@/types/game'
import { InfoSelector, InfoStrip, MAX_INFO_SLOTS } from './InfoSelector'
import {
  actionLabels,
  applyAction,
  computeBlindMarket,
  computeRunningPnl,
  getFollowUpActions,
  POSITION_SIZES,
} from './scoring'

type Stage = 'intro' | 'info' | 'decision' | 'revealing' | 'finished'

const directionLabels: Record<BlindDirection, string> = {
  long: 'Лонг',
  short: 'Шорт',
  flat: 'Вне рынка',
}

export function BlindMarketGame({
  scenario,
  onComplete,
}: {
  scenario: BlindMarketScenario
  onComplete: (result: BlindMarketResult) => void
}) {
  const [stage, setStage] = useState<Stage>('intro')
  const [checkpointIndex, setCheckpointIndex] = useState(0)
  const [selectedInfo, setSelectedInfo] = useState<BlindInfoKey[]>([])
  const [decisions, setDecisions] = useState<BlindDecision[]>([])

  const [direction, setDirection] = useState<BlindDirection | null>(null)
  const [size, setSize] = useState<number | null>(null)
  const [action, setAction] = useState<BlindFollowUpAction | null>(null)
  const [confidence, setConfidence] = useState(70)

  const { visible, revealTo, reset } = useReveal(scenario.checkpoints[0])
  const decisionStartRef = useRef<number>(Date.now())

  const currentExposure = decisions.at(-1)?.exposure ?? 0
  const lastCandle = scenario.candles[Math.min(visible, scenario.candles.length) - 1]

  const runningPnl = useMemo(
    () => computeRunningPnl(scenario, decisions, visible - 1),
    [scenario, decisions, visible],
  )

  const markers = useMemo<ChartMarker[]>(
    () =>
      decisions.map((decision, index) => ({
        candleIndex: scenario.checkpoints[index] - 1,
        position: decision.exposure >= 0 ? 'belowBar' : 'aboveBar',
        shape: decision.exposure > 0 ? 'arrowUp' : decision.exposure < 0 ? 'arrowDown' : 'circle',
        color: decision.exposure === 0 ? '#7b5cff' : decision.exposure > 0 ? '#2ebd85' : '#f0616d',
        text: exposureLabel(decision.exposure),
      })),
    [decisions, scenario.checkpoints],
  )

  useEffect(() => {
    // Новый сценарий (например, из debug-панели) полностью сбрасывает раунд.
    setStage('intro')
    setCheckpointIndex(0)
    setSelectedInfo([])
    setDecisions([])
    setDirection(null)
    setSize(null)
    setAction(null)
    setConfidence(70)
    reset(scenario.checkpoints[0])
  }, [scenario, reset])

  const selectInfo = (key: BlindInfoKey) => {
    setSelectedInfo((current) => {
      if (current.includes(key) || current.length >= MAX_INFO_SLOTS) return current
      return [...current, key]
    })
  }

  const startDecision = useCallback(() => {
    decisionStartRef.current = Date.now()
    setStage('decision')
  }, [])

  const commitDecision = (exposure: number, decision: Omit<BlindDecision, 'exposure'>) => {
    const nextDecisions = [...decisions, { ...decision, exposure }]
    setDecisions(nextDecisions)
    setDirection(null)
    setSize(null)
    setAction(null)
    setStage('revealing')

    const boundaries = [...scenario.checkpoints, scenario.candles.length]
    const target = boundaries[checkpointIndex + 1]
    const isLast = checkpointIndex === scenario.checkpoints.length - 1

    revealTo(target, () => {
      if (isLast) {
        setStage('finished')
        onComplete(buildResult(scenario, nextDecisions, selectedInfo))
        return
      }
      setCheckpointIndex((index) => index + 1)
      decisionStartRef.current = Date.now()
      setStage('decision')
    })
  }

  const submitEntry = () => {
    if (!direction) return
    if (direction !== 'flat' && size === null) return

    const exposure =
      direction === 'flat' ? 0 : (direction === 'long' ? 1 : -1) * (size ?? 0.5)

    commitDecision(exposure, {
      checkpointIndex: 0,
      direction,
      confidence,
      priceAtDecision: scenario.candles[scenario.checkpoints[0] - 1].close,
      timeMs: Date.now() - decisionStartRef.current,
    })
  }

  const submitFollowUp = () => {
    if (!action) return
    const exposure = applyAction(currentExposure, action)

    commitDecision(exposure, {
      checkpointIndex,
      direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat',
      action,
      confidence,
      priceAtDecision: scenario.candles[scenario.checkpoints[checkpointIndex] - 1].close,
      timeMs: Date.now() - decisionStartRef.current,
    })
  }

  if (stage === 'intro') {
    return <Intro onStart={() => setStage('info')} />
  }

  if (stage === 'info') {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-3">
          <SectionLabel>Перед входом</SectionLabel>
          <h2 className="text-3xl font-light tracking-[-0.02em] text-chalk-50 sm:text-4xl">
            Что тебе важно знать?
          </h2>
          <p className="text-sm leading-relaxed text-chalk-400">
            Ты можешь открыть только два блока информации. Остальные останутся
            закрытыми на весь сценарий.
          </p>
        </div>

        <div className="mt-8">
          <InfoSelector
            scenario={scenario}
            selected={selectedInfo}
            onSelect={selectInfo}
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="tnum text-sm text-chalk-500">
            Выбрано {selectedInfo.length} из {MAX_INFO_SLOTS}
          </span>
          <Button
            variant="primary"
            size="lg"
            disabled={selectedInfo.length < MAX_INFO_SLOTS}
            onClick={startDecision}
          >
            Открыть рынок
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    )
  }

  const isEntry = checkpointIndex === 0
  const followUpActions = getFollowUpActions(currentExposure)

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <header className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-center gap-3">
              <EyeOff className="h-4 w-4 text-chalk-500" aria-hidden />
              <span className="text-sm text-chalk-400">
                Актив и дата скрыты
              </span>
            </div>
            <span className="tnum text-sm text-chalk-500">
              Решение {Math.min(checkpointIndex + 1, 3)} из {scenario.checkpoints.length}
            </span>
          </header>

          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <span className="tnum text-2xl font-light text-chalk-50">
                {lastCandle ? lastCandle.close.toFixed(2) : '—'}
              </span>
              <span className={`tnum text-sm ${pnlColor(runningPnl)}`}>
                {decisions.length ? formatMoney(runningPnl) : 'Позиция не открыта'}
              </span>
            </div>
            <CandleChart candles={scenario.candles} visibleCount={visible} markers={markers} />
          </div>

          <InfoStrip scenario={scenario} selected={selectedInfo} />
        </div>

        <aside className="flex flex-col gap-6">
          <PositionPanel exposure={currentExposure} pnl={runningPnl} />

          {stage === 'revealing' ? (
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-6">
              <p className="text-sm text-chalk-400">Рынок идёт дальше…</p>
            </div>
          ) : isEntry ? (
            <EntryControls
              direction={direction}
              size={size}
              confidence={confidence}
              onDirection={(value) => {
                setDirection(value)
                if (value === 'flat') setSize(null)
              }}
              onSize={setSize}
              onConfidence={setConfidence}
              onSubmit={submitEntry}
            />
          ) : (
            <FollowUpControls
              actions={followUpActions}
              selected={action}
              confidence={confidence}
              exposure={currentExposure}
              onSelect={setAction}
              onConfidence={setConfidence}
              onSubmit={submitFollowUp}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 01</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Слепой рынок
        </h1>
      </div>

      <div className="flex flex-col gap-4 text-base leading-relaxed text-chalk-200">
        <p>Перед тобой реальный рыночный паттерн, но мы скрыли актив и дату.</p>
        <p>Ты будешь принимать решение несколько раз по мере развития ситуации.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-chalk-400">
        <span className="tnum">Капитал: {CAPITAL.toLocaleString('ru-RU')}</span>
        <span>Три точки принятия решения</span>
        <span>Два доступных блока информации</span>
      </div>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Открыть рынок
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function PositionPanel({ exposure, pnl }: { exposure: number; pnl: number }) {
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
          Результат
        </span>
        <span className={`tnum text-base ${pnlColor(pnl)}`}>
          {formatPercent((pnl / CAPITAL) * 100)}
        </span>
      </div>
    </div>
  )
}

function EntryControls({
  direction,
  size,
  confidence,
  onDirection,
  onSize,
  onConfidence,
  onSubmit,
}: {
  direction: BlindDirection | null
  size: number | null
  confidence: number
  onDirection: (value: BlindDirection) => void
  onSize: (value: number) => void
  onConfidence: (value: number) => void
  onSubmit: () => void
}) {
  const needsSize = direction !== null && direction !== 'flat'
  const ready = direction !== null && (!needsSize || size !== null)

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-normal tracking-tight text-chalk-50">Что ты делаешь?</h2>
        <div className="grid gap-2.5">
          <ChoiceButton
            label={directionLabels.long}
            tone="up"
            selected={direction === 'long'}
            onClick={() => onDirection('long')}
          />
          <ChoiceButton
            label={directionLabels.short}
            tone="down"
            selected={direction === 'short'}
            onClick={() => onDirection('short')}
          />
          <ChoiceButton
            label={directionLabels.flat}
            selected={direction === 'flat'}
            onClick={() => onDirection('flat')}
          />
        </div>
      </div>

      {needsSize ? (
        <div className="flex animate-fade-up flex-col gap-3 border-t border-ink-800 pt-5">
          <h3 className="text-sm text-chalk-400">Размер позиции</h3>
          <div className="grid grid-cols-4 gap-2">
            {POSITION_SIZES.map((value) => (
              <PillButton
                key={value}
                selected={size === value}
                onClick={() => onSize(value)}
              >
                {value * 100}%
              </PillButton>
            ))}
          </div>
        </div>
      ) : null}

      {direction ? (
        <div className="animate-fade-up border-t border-ink-800 pt-5">
          <ConfidenceSlider value={confidence} onChange={onConfidence} />
        </div>
      ) : null}

      <Button variant="primary" size="lg" fullWidth disabled={!ready} onClick={onSubmit}>
        Подтвердить решение
      </Button>
    </div>
  )
}

function FollowUpControls({
  actions,
  selected,
  confidence,
  exposure,
  onSelect,
  onConfidence,
  onSubmit,
}: {
  actions: BlindFollowUpAction[]
  selected: BlindFollowUpAction | null
  confidence: number
  exposure: number
  onSelect: (action: BlindFollowUpAction) => void
  onConfidence: (value: number) => void
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-normal tracking-tight text-chalk-50">
          Рынок изменился. Что дальше?
        </h2>
        <div className="grid gap-2.5">
          {actions.map((item) => (
            <ChoiceButton
              key={item}
              label={actionLabels[item]}
              hint={hintForAction(item, exposure)}
              selected={selected === item}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      </div>

      {selected ? (
        <div className="animate-fade-up border-t border-ink-800 pt-5">
          <ConfidenceSlider value={confidence} onChange={onConfidence} />
        </div>
      ) : null}

      <Button variant="primary" size="lg" fullWidth disabled={!selected} onClick={onSubmit}>
        Подтвердить решение
      </Button>
    </div>
  )
}

/** Подсказка показывает результат действия, а не объясняет правила. */
function hintForAction(action: BlindFollowUpAction, exposure: number): string | undefined {
  const next = applyAction(exposure, action)
  if (action === 'hold') return undefined
  return `Станет: ${exposureLabel(next)}`
}

function buildResult(
  scenario: BlindMarketScenario,
  decisions: BlindDecision[],
  selectedInformation: BlindInfoKey[],
): BlindMarketResult {
  const computation = computeBlindMarket(scenario, decisions)

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    pnl: computation.pnl,
    pnlPercent: computation.pnlPercent,
    maxDrawdown: computation.maxDrawdown,
    selectedInformation,
    decisions,
    averageConfidence: computation.averageConfidence,
    directionChanges: computation.directionChanges,
    timeToDecision: decisions.map((decision) => decision.timeMs),
    segmentReturns: computation.segmentReturns,
    score: computation.score,
  }
}
