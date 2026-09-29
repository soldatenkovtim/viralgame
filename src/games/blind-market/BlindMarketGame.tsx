import { trackEvent } from '@/lib/analytics'
import { difficultyFor } from '@/modes/config'
import { useCountdown } from '@/hooks/useCountdown'
import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, EyeOff, X } from 'lucide-react'
import {
  TradingChart,
  type ChartDrawEvent,
  type DrawingTool,
} from '@/components/charts/TradingChart'
import { Button } from '@/components/ui/Button'
import { ChoiceButton, PillButton } from '@/components/ui/ChoiceButton'
import { ConfidenceSlider } from '@/components/ui/ConfidenceSlider'
import { SectionLabel } from '@/components/ui/Card'
import { useReveal } from '@/hooks/useReveal'
import {
  exposureLabel,
  formatMoney,
  formatPercent,
  formatPrice,
  pnlColor,
} from '@/lib/formatting'
import { CAPITAL } from '@/lib/constants'
import type {
  BlindDecision,
  BlindDirection,
  BlindFollowUpAction,
  BlindInfoKey,
  BlindMarketResult,
  BlindMarketScenario,
  ChartAnnotations,
} from '@/types/game'
import { DrawingToolbar, MAX_LEVELS, TimeframeSwitch } from './ChartToolbar'
import { InfoSelector, InfoStrip, MAX_INFO_SLOTS } from './InfoSelector'
import {
  actionLabels,
  applyAction,
  buildTradeTimeline,
  computeBlindMarket,
  getFollowUpActions,
  POSITION_SIZES,
  simulateBlind,
} from './scoring'
import { type TimeframeId } from './timeframes'
import { tradeMarkers } from './tradeAnnotations'

type Stage = 'intro' | 'info' | 'decision' | 'revealing' | 'finished'

const directionLabels: Record<BlindDirection, string> = {
  long: 'Лонг',
  short: 'Шорт',
  flat: 'Вне рынка',
}

const EMPTY_ANNOTATIONS: ChartAnnotations = { levels: [], trendLine: null }
/** Минимальный зазор между стопом и текущей ценой. */
const STOP_GAP = 0.0005

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function BlindMarketGame({
  scenario,
  onComplete,
}: {
  context?: ChallengeContext
  scenario: BlindMarketScenario
  onComplete: (result: BlindMarketResult) => void
}) {
  const difficulty = difficultyFor('blind-market', scenario.mode === 'advanced')
  const advanced = !difficulty.hintsEnabled
  const committed = useRef(false)
  const [stage, setStage] = useState<Stage>('intro')
  const [checkpointIndex, setCheckpointIndex] = useState(0)
  const [selectedInfo, setSelectedInfo] = useState<BlindInfoKey[]>([])
  const [decisions, setDecisions] = useState<BlindDecision[]>([])

  const [direction, setDirection] = useState<BlindDirection | null>(null)
  const [size, setSize] = useState<number | null>(null)
  const [action, setAction] = useState<BlindFollowUpAction | null>(null)
  const [confidence, setConfidence] = useState(70)
  const [stopPrice, setStopPrice] = useState<number | null>(null)
  const [stopError, setStopError] = useState<string | null>(null)

  const [timeframe, setTimeframe] = useState<TimeframeId>(scenario.availableTimeframes.includes('1h') ? '1h' : scenario.baseTimeframe)
  const [annotations, setAnnotations] = useState<ChartAnnotations>(EMPTY_ANNOTATIONS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<DrawingTool>('none')
  const idRef = useRef(0)
  const annotationsRef = useRef(annotations)

  const { visible, revealTo, reset } = useReveal(scenario.checkpoints[0], 55, 2)
  const decisionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  const timeline = useMemo(
    () => buildTradeTimeline(scenario, decisions, visible - 1),
    [scenario, decisions, visible],
  )
  const markers = useMemo(() => tradeMarkers(timeline.events), [timeline.events])

  const currentExposure = timeline.exposure
  const currentPrice = scenario.candles[visible - 1].close
  const dayAgo = (scenario.candles.slice(0, visible).findLast(c => c.time <= scenario.candles[visible - 1].time - 86400) ?? scenario.candles[0]).close
  const dayChange = ((currentPrice - dayAgo) / dayAgo) * 100

  const isDeciding = stage === 'decision'
  const entryMode = currentExposure === 0

  const entrySide = direction === 'long' ? 1 : direction === 'short' ? -1 : 0
  const pendingExposure: number | null = !isDeciding
    ? null
    : entryMode
      ? direction === null
        ? null
        : direction === 'flat'
          ? 0
          : size === null
            ? null
            : entrySide * size
      : action === null
        ? null
        : applyAction(currentExposure, action)
  const pendingSide: number | null = !isDeciding
    ? null
    : entryMode
      ? direction === null
        ? null
        : entrySide
      : pendingExposure === null
        ? null
        : Math.sign(pendingExposure)

  // Сторона, для которой сейчас имеет смысл стоп: +1 лонг, −1 шорт, 0 — стоп не нужен.
  const stopSide = pendingSide ?? Math.sign(currentExposure)
  const shownStop = stopSide !== 0 ? stopPrice : null

  const entryLine = useMemo(
    () =>
      timeline.entryPrice !== null && currentExposure !== 0
        ? { price: timeline.entryPrice, side: (currentExposure > 0 ? 1 : -1) as 1 | -1 }
        : null,
    [timeline.entryPrice, currentExposure],
  )

  const lastStopHit = isDeciding
    ? timeline.stopHits.find((hit) => hit.segment === checkpointIndex - 1)
    : undefined

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
    setStopPrice(null)
    setStopError(null)
    setTimeframe(scenario.availableTimeframes.includes('1h') ? '1h' : scenario.baseTimeframe)
    setAnnotations(EMPTY_ANNOTATIONS)
    setSelectedId(null)
    setTool('none')
    reset(scenario.checkpoints[0])
  }, [scenario, reset])

  const isValidStop = (price: number, side: number) =>
    side > 0 ? price < currentPrice : side < 0 ? price > currentPrice : false

  const clampStop = (price: number, side: number) =>
    round2(
      side > 0
        ? Math.min(price, currentPrice * (1 - STOP_GAP))
        : Math.max(price, currentPrice * (1 + STOP_GAP)),
    )

  const deleteById = useCallback((id: string) => {
    setAnnotations((current) => ({
      levels: current.levels.filter((level) => level.id !== id),
      trendLine: current.trendLine?.id === id ? null : current.trendLine,
    }))
    setSelectedId(null)
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (event.key === 'Escape') {
        setTool('none')
        setSelectedId(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        deleteById(selectedId)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedId, deleteById])

  const handleDraw = (event: ChartDrawEvent) => {
    if (event.type === 'level') {
      if (annotations.levels.length >= MAX_LEVELS) return
      idRef.current += 1
      const id = `level-${idRef.current}`
      setAnnotations((current) => ({
        ...current,
        levels: [...current.levels, { id, price: round2(event.price) }],
      }))
      setTool('none')
      return
    }

    if (event.type === 'trend') {
      idRef.current += 1
      const id = `trend-${idRef.current}`
      setAnnotations((current) => ({ ...current, trendLine: { id, a: event.a, b: event.b } }))
      setTool('none')
      return
    }

    if (!isDeciding || stopSide === 0) return
    if (!isValidStop(event.price, stopSide)) {
      setStopError(
        stopSide > 0
          ? 'Для лонга стоп ставится ниже текущей цены'
          : 'Для шорта стоп ставится выше текущей цены',
      )
      return
    }
    setStopPrice(round2(event.price))
    setStopError(null)
    setTool('none')
  }

  const selectInfo = (key: BlindInfoKey) => {
    setSelectedInfo((current) => {
      if (current.includes(key) || current.length >= MAX_INFO_SLOTS) return current
      return [...current, key]
    })
  }

  const startDecision = useCallback(() => {
    committed.current = false
    decisionStartRef.current = Date.now()
    setStage('decision')
  }, [])

  const chooseDirection = (value: BlindDirection) => {
    setDirection(value)
    if (value === 'flat') {
      setSize(null)
      if (tool === 'stop') setTool('none')
      return
    }
    const side = value === 'long' ? 1 : -1
    if (stopPrice !== null && !isValidStop(stopPrice, side)) setStopPrice(null)
  }

  const chooseAction = (value: BlindFollowUpAction) => {
    setAction(value)
    const next = applyAction(currentExposure, value)
    if (next === 0 && tool === 'stop') setTool('none')
    if (next !== 0 && stopPrice !== null && !isValidStop(stopPrice, Math.sign(next))) {
      setStopPrice(null)
    }
  }

  const commitDecision = (exposure: number, decision: Omit<BlindDecision, 'exposure'>) => {
    if (committed.current || stage !== 'decision') return
    committed.current = true
    const nextDecisions = [...decisions, { ...decision, exposure }]
    setDecisions(nextDecisions)
    setDirection(null)
    setSize(null)
    setAction(null)
    setStopError(null)
    setTool('none')
    if (exposure === 0) setStopPrice(null)
    setStage('revealing')

    const boundaries = [...scenario.checkpoints, scenario.candles.length]
    const target = boundaries[checkpointIndex + 1]
    const isLast = checkpointIndex === scenario.checkpoints.length - 1

    revealTo(target, () => {
      if (isLast) {
        setStage('finished')
        onComplete(buildResult(scenario, nextDecisions, selectedInfo, annotationsRef.current))
        return
      }
      // Сработавший стоп закрывает позицию — старый уровень стопа больше не нужен.
      if (simulateBlind(scenario, nextDecisions, target - 1).exposure === 0) setStopPrice(null)
      setCheckpointIndex((index) => index + 1)
      committed.current = false
      decisionStartRef.current = Date.now()
      setStage('decision')
    })
  }

  const submit = () => {
    if (pendingExposure === null) return
    const exposure = pendingExposure
    const stop =
      exposure !== 0 && stopPrice !== null && isValidStop(stopPrice, Math.sign(exposure))
        ? stopPrice
        : undefined

    const entryAction: BlindFollowUpAction | undefined =
      checkpointIndex === 0
        ? undefined
        : direction === 'long'
          ? 'enter-long'
          : direction === 'short'
            ? 'enter-short'
            : 'stay-flat'

    commitDecision(exposure, {
      checkpointIndex,
      direction: exposure > 0 ? 'long' : exposure < 0 ? 'short' : 'flat',
      action: entryMode ? entryAction : (action ?? undefined),
      confidence,
      priceAtDecision: currentPrice,
      stopPrice: stop,
      timeMs: Date.now() - decisionStartRef.current,
    })
  }

  const { remaining } = useCountdown({ seconds: difficulty.timerSeconds, active: advanced && stage === 'decision', resetKey: `${scenario.id}-${checkpointIndex}`,
    onExpire: () => commitDecision(currentExposure, { checkpointIndex, direction: currentExposure > 0 ? 'long' : currentExposure < 0 ? 'short' : 'flat',
      action: checkpointIndex === 0 ? undefined : currentExposure === 0 ? 'stay-flat' : 'hold', confidence, priceAtDecision: currentPrice,
      stopPrice: currentExposure !== 0 ? stopPrice ?? undefined : undefined, timeMs: difficulty.timerSeconds * 1000 }) })

  if (stage === 'intro') {
    return <Intro advanced={advanced} onStart={() => { trackEvent('scenario_started', { challengeType: 'blind-market', scenarioId: scenario.id, mode: scenario.mode }); if (advanced) startDecision(); else setStage('info') }} />
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
            Объём будет виден прямо на графике. Из остального ты можешь открыть только
            два блока — другие останутся закрытыми на весь сценарий.
          </p>
        </div>

        <div className="mt-8">
          <InfoSelector scenario={scenario} selected={selectedInfo} onSelect={selectInfo} />
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

  const chartHint =
    tool === 'level'
      ? 'Кликни по графику, чтобы поставить уровень'
      : tool === 'trend'
        ? 'Кликни две точки, чтобы провести трендовую линию'
        : tool === 'stop'
          ? (stopError ??
            (stopSide > 0
              ? 'Кликни ниже текущей цены, чтобы поставить стоп'
              : 'Кликни выше текущей цены, чтобы поставить стоп'))
          : null

  const stopControl = (
    <StopControl
      stopPrice={shownStop}
      side={stopSide}
      exposure={pendingExposure ?? currentExposure}
      currentPrice={currentPrice}
      placing={tool === 'stop'}
      onPlace={() => {
        setStopError(null)
        setSelectedId(null)
        setTool(tool === 'stop' ? 'none' : 'stop')
      }}
      onRemove={() => setStopPrice(null)}
    />
  )

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-chalk-400">
            <EyeOff className="h-4 w-4 text-chalk-500" aria-hidden />
            Актив и дата скрыты
          </span>
          {!advanced && <InfoStrip scenario={scenario} selected={selectedInfo} />}
          {advanced && stage === 'decision' && <span role="timer" className="text-sm text-violet-soft">{remaining} с · по истечении — без изменения позиции</span>}
        </div>
        <DecisionSteps
          current={checkpointIndex}
          total={scenario.checkpoints.length}
          finished={stage === 'finished'}
        />
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(270px,27%)]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="tnum text-xl font-light text-chalk-50">
                  {formatPrice(currentPrice)}
                </span>
                <span className={`tnum text-xs ${pnlColor(dayChange)}`}>
                  {formatPercent(dayChange, 2)} за 24ч
                </span>
              </div>
              <TimeframeSwitch options={scenario.availableTimeframes} value={timeframe} onChange={setTimeframe} />
            </div>
            <DrawingToolbar
              tool={tool === 'stop' ? 'none' : tool}
              levelCount={annotations.levels.length}
              hasTrendLine={annotations.trendLine !== null}
              hasSelection={selectedId !== null}
              hasDrawings={annotations.levels.length > 0 || annotations.trendLine !== null}
              onTool={(next) => {
                setSelectedId(null)
                setTool(next)
              }}
              onDeleteSelected={() => selectedId && deleteById(selectedId)}
              onClear={() => {
                setAnnotations(EMPTY_ANNOTATIONS)
                setSelectedId(null)
              }}
            />
          </div>

          <TradingChart
            className="h-[clamp(420px,calc(100vh_-_300px),820px)]"
            candles={scenario.candles}
            visibleCount={visible}
            timeframe={timeframe}
            annotations={annotations}
            selectedId={selectedId}
            tool={tool}
            entry={entryLine}
            stopPrice={shownStop}
            markers={markers}
            editable
            stopDraggable={isDeciding && stopSide !== 0}
            hint={chartHint}
            onDraw={handleDraw}
            onSelect={setSelectedId}
            onMoveLevel={(id, price) =>
              setAnnotations((current) => ({
                ...current,
                levels: current.levels.map((level) =>
                  level.id === id ? { ...level, price: round2(price) } : level,
                ),
              }))
            }
            onMoveStop={(price) => setStopPrice(clampStop(price, stopSide))}
          />

          <p className="hidden border-t border-ink-800 px-4 py-2 text-[11px] text-chalk-500 md:block">
            Колесо — масштаб · перетаскивание — сдвиг · Esc — отменить инструмент · Delete —
            удалить выбранное
          </p>
        </section>

        <aside className="flex flex-col gap-4 md:sticky md:top-4 md:self-start">
          <PositionPanel
            exposure={currentExposure}
            pnl={timeline.pnl}
            entryPrice={entryLine?.price ?? null}
            stopPrice={currentExposure !== 0 ? stopPrice : null}
            currentPrice={currentPrice}
          />

          {stage === 'revealing' || stage === 'finished' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5">
              <p className="text-sm text-chalk-200">
                {stage === 'finished' ? 'Сессия завершена' : 'Рынок идёт дальше…'}
              </p>
              <RevealProgress scenario={scenario} checkpointIndex={checkpointIndex} visible={visible} />
              <p className="text-xs leading-relaxed text-chalk-500">
                Разметку можно продолжать править — она сохранится до конца сценария.
              </p>
            </div>
          ) : entryMode ? (
            <EntryControls
              title={checkpointIndex === 0 ? 'Что ты делаешь?' : 'Ты вне рынка. Что дальше?'}
              notice={
                lastStopHit
                  ? `Стоп сработал по ${formatPrice(lastStopHit.price)} — позиция закрыта.`
                  : null
              }
              direction={direction}
              size={size}
              confidence={confidence}
              stopControl={stopControl}
              onDirection={chooseDirection}
              onSize={setSize}
              onConfidence={setConfidence}
              onSubmit={submit}
            />
          ) : (
            <FollowUpControls
              actions={getFollowUpActions(currentExposure)}
              selected={action}
              confidence={confidence}
              exposure={currentExposure}
              stopControl={
                action !== null && applyAction(currentExposure, action) !== 0 ? stopControl : null
              }
              onSelect={chooseAction}
              onConfidence={setConfidence}
              onSubmit={submit}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function Intro({ advanced, onStart }: { advanced: boolean; onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 01</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Слепой рынок
        </h1>
      </div>

      <div className="flex flex-col gap-4 text-base leading-relaxed text-chalk-200">
        <p>{advanced ? 'Перед тобой синтетический рынок с ложными сигналами и неоднозначными движениями.' : 'Перед тобой реальный рыночный паттерн, но мы скрыли актив и дату.'}</p>
        <p>
          Короткая сессия: три решения по мере развития ситуации. График рабочий — можно
          менять таймфрейм, размечать уровни и ставить стоп.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-chalk-400">
        <span className="tnum">Капитал: {CAPITAL.toLocaleString('ru-RU')}</span>
        <span>{advanced ? 'Три точки принятия решения, по 13 секунд после появления рынка' : 'Три точки принятия решения, 2–3 минуты'}</span>
        <span>Минутные и часовые таймфреймы, дневной контекст и объём на графике</span>
        <span>{advanced ? 'Оцени движение и объём на графике без текстовых подсказок' : 'Два дополнительных блока информации на выбор'}</span>
      </div>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Открыть рынок
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function DecisionSteps({
  current,
  total,
  finished,
}: {
  current: number
  total: number
  finished: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 w-6 rounded-full ${
              finished || index < current
                ? 'bg-violet-accent'
                : index === current
                  ? 'bg-violet-accent/50'
                  : 'bg-ink-700'
            }`}
          />
        ))}
      </div>
      <span className="tnum text-sm text-chalk-500">
        Решение {Math.min(current + 1, total)} из {total}
      </span>
    </div>
  )
}

function RevealProgress({
  scenario,
  checkpointIndex,
  visible,
}: {
  scenario: BlindMarketScenario
  checkpointIndex: number
  visible: number
}) {
  const boundaries = [...scenario.checkpoints, scenario.candles.length]
  const from = boundaries[checkpointIndex]
  const to = boundaries[checkpointIndex + 1]
  const progress = Math.min(1, Math.max(0, (visible - from) / (to - from)))

  return (
    <div className="h-1 overflow-hidden rounded-full bg-ink-700">
      <div
        className="h-full rounded-full bg-violet-accent transition-[width] duration-100"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}

function PanelStat({
  label,
  value,
  hint,
  valueClassName = 'text-chalk-50',
}: {
  label: string
  value: string
  hint?: string
  valueClassName?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">{label}</span>
      <span className={`tnum truncate text-sm ${valueClassName}`}>{value}</span>
      {hint ? <span className="tnum text-[11px] text-chalk-500">{hint}</span> : null}
    </div>
  )
}

function PositionPanel({
  exposure,
  pnl,
  entryPrice,
  stopPrice,
  currentPrice,
}: {
  exposure: number
  pnl: number
  entryPrice: number | null
  stopPrice: number | null
  currentPrice: number
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
      <PanelStat label="Позиция" value={exposureLabel(exposure)} />
      <PanelStat
        label="Результат"
        value={formatPercent((pnl / CAPITAL) * 100)}
        hint={formatMoney(pnl)}
        valueClassName={pnlColor(pnl)}
      />
      <PanelStat label="Вход" value={entryPrice !== null ? formatPrice(entryPrice) : '—'} />
      <PanelStat
        label="Стоп"
        value={stopPrice !== null ? formatPrice(stopPrice) : '—'}
        hint={
          stopPrice !== null
            ? formatPercent(((stopPrice - currentPrice) / currentPrice) * 100, 2)
            : undefined
        }
        valueClassName={stopPrice !== null ? 'text-market-down' : 'text-chalk-500'}
      />
    </div>
  )
}

function StopControl({
  stopPrice,
  side,
  exposure,
  currentPrice,
  placing,
  onPlace,
  onRemove,
}: {
  stopPrice: number | null
  side: number
  exposure: number
  currentPrice: number
  placing: boolean
  onPlace: () => void
  onRemove: () => void
}) {
  if (side === 0) return null

  if (stopPrice === null) {
    return (
      <button
        type="button"
        onClick={onPlace}
        aria-pressed={placing}
        className={`flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-lg border border-dashed px-4 py-2 text-left text-sm transition-colors duration-150 ${
          placing
            ? 'border-market-down bg-market-down/8 text-chalk-50'
            : 'border-ink-600 text-chalk-200 hover:border-market-down/60'
        }`}
      >
        <span>{placing ? 'Кликни по графику…' : 'Поставить стоп на графике'}</span>
        <span className="text-xs text-chalk-500">
          {placing ? 'Нажми ещё раз, чтобы отменить' : 'Необязательно'}
        </span>
      </button>
    )
  }

  const distance = ((stopPrice - currentPrice) / currentPrice) * 100
  const risk = Math.abs(distance) * Math.abs(exposure)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-market-down/40 bg-market-down/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="tnum text-sm text-chalk-50">
          Стоп {formatPrice(stopPrice)}{' '}
          <span className="text-chalk-500">({formatPercent(distance, 2)})</span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-chalk-500 hover:text-chalk-50"
          aria-label="Убрать стоп"
          title="Убрать стоп"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <span className="tnum text-xs text-chalk-400">
        Риск ≈ {formatPercent(-risk, 2)} капитала · линию можно перетащить
      </span>
    </div>
  )
}

function EntryControls({
  title,
  notice,
  direction,
  size,
  confidence,
  stopControl,
  onDirection,
  onSize,
  onConfidence,
  onSubmit,
}: {
  title: string
  notice: string | null
  direction: BlindDirection | null
  size: number | null
  confidence: number
  stopControl: ReactNode
  onDirection: (value: BlindDirection) => void
  onSize: (value: number) => void
  onConfidence: (value: number) => void
  onSubmit: () => void
}) {
  const needsSize = direction !== null && direction !== 'flat'
  const ready = direction !== null && (!needsSize || size !== null)

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-normal tracking-tight text-chalk-50">{title}</h2>
        {notice ? (
          <p className="rounded-lg border border-market-down/30 bg-market-down/5 px-3 py-2 text-xs text-chalk-200">
            {notice}
          </p>
        ) : null}
        <div className="grid gap-2">
          <ChoiceButton
            compact
            label={directionLabels.long}
            tone="up"
            selected={direction === 'long'}
            onClick={() => onDirection('long')}
          />
          <ChoiceButton
            compact
            label={directionLabels.short}
            tone="down"
            selected={direction === 'short'}
            onClick={() => onDirection('short')}
          />
          <ChoiceButton
            compact
            label={directionLabels.flat}
            selected={direction === 'flat'}
            onClick={() => onDirection('flat')}
          />
        </div>
      </div>

      {needsSize ? (
        <div className="flex animate-fade-up flex-col gap-3 border-t border-ink-800 pt-4">
          <h3 className="text-sm text-chalk-400">Размер позиции</h3>
          <div className="grid grid-cols-3 gap-2">
            {POSITION_SIZES.map((value) => (
              <PillButton key={value} selected={size === value} onClick={() => onSize(value)}>
                {value * 100}%
              </PillButton>
            ))}
          </div>
          {stopControl}
        </div>
      ) : null}

      {direction ? (
        <div className="animate-fade-up border-t border-ink-800 pt-4">
          <ConfidenceSlider value={confidence} onChange={onConfidence} />
        </div>
      ) : null}

      <Button variant="primary" size="md" fullWidth disabled={!ready} onClick={onSubmit}>
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
  stopControl,
  onSelect,
  onConfidence,
  onSubmit,
}: {
  actions: BlindFollowUpAction[]
  selected: BlindFollowUpAction | null
  confidence: number
  exposure: number
  stopControl: ReactNode
  onSelect: (action: BlindFollowUpAction) => void
  onConfidence: (value: number) => void
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-normal tracking-tight text-chalk-50">
          Рынок изменился. Что дальше?
        </h2>
        <div className="grid gap-2">
          {actions.map((item) => (
            <ChoiceButton
              key={item}
              compact
              label={actionLabels[item]}
              hint={hintForAction(item, exposure)}
              selected={selected === item}
              disabled={item === 'increase' && Math.abs(exposure) >= 1}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      </div>

      {stopControl ? (
        <div className="animate-fade-up border-t border-ink-800 pt-4">{stopControl}</div>
      ) : null}

      {selected ? (
        <div className="animate-fade-up border-t border-ink-800 pt-4">
          <ConfidenceSlider value={confidence} onChange={onConfidence} />
        </div>
      ) : null}

      <Button variant="primary" size="md" fullWidth disabled={!selected} onClick={onSubmit}>
        Подтвердить решение
      </Button>
    </div>
  )
}

/** Подсказка показывает результат действия, а не объясняет правила. */
function hintForAction(action: BlindFollowUpAction, exposure: number): string | undefined {
  if (action === 'hold') return undefined
  if (action === 'increase' && Math.abs(exposure) >= 1) return 'Позиция уже 100%'
  return `Станет: ${exposureLabel(applyAction(exposure, action))}`
}

function buildResult(
  scenario: BlindMarketScenario,
  decisions: BlindDecision[],
  selectedInformation: BlindInfoKey[],
  annotations: ChartAnnotations,
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
    stopHits: computation.stopHits,
    annotations,
  }
}
