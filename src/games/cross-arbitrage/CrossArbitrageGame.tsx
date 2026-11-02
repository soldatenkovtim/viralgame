import { ChallengeIntro } from '@/components/challenge/ChallengeIntro'
import { ChallengeIllustration } from '@/components/challenge/ChallengeIllustration'
import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RoundFeedback } from './RoundFeedback'
import { QuoteBoard, RoundClock, TradeTicket } from './CrossArbitrageTerminal'
import { sessionScenarios } from '@/data/crossArbitrageScenarios'
import { trackEvent } from '@/lib/analytics'
import type {
  ArbitrageRoundResult,
  CrossArbitrageResult,
  CrossArbitrageSession,
} from '@/types/game'
import {
  ARB_DECISION_SECONDS,
  buildQuotePath,
  quoteStepAt,
} from './engine'
import {
  buildCrossArbitrageResult,
  evaluateRound,
} from './scoring'

type Stage = 'intro' | 'market' | 'feedback'

const FEEDBACK_MS = 1500
const TICK_MS = 200

export function CrossArbitrageGame({
  context,
  session,
  timerDisabled = false,
  onComplete,
}: {
  context?: ChallengeContext
  session: CrossArbitrageSession
  timerDisabled?: boolean
  onComplete: (result: CrossArbitrageResult) => void
}) {
  const scenarios = useMemo(() => sessionScenarios(session), [session])

  const [stage, setStage] = useState<Stage>('intro')
  const [roundIndex, setRoundIndex] = useState(0)
  const [rounds, setRounds] = useState<ArbitrageRoundResult[]>([])
  const [buyVenue, setBuyVenue] = useState<string | null>(null)
  const [sellVenue, setSellVenue] = useState<string | null>(null)
  const [positionSize, setPositionSize] = useState<number>(0.25)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [feedbackRemainingMs, setFeedbackRemainingMs] = useState(FEEDBACK_MS)

  const startRef = useRef(0)
  const committedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const scenario = scenarios[roundIndex]
  const limitMs = (scenario.durationSeconds || ARB_DECISION_SECONDS) * 1000
  const path = useMemo(() => buildQuotePath(scenario), [scenario])
  const step = quoteStepAt(elapsedMs, path.length, scenario.quoteStepMs)
  const quotes = path[step]

  useEffect(() => {
    setStage('intro')
    setRoundIndex(0)
    setRounds([])
    setFeedbackRemainingMs(FEEDBACK_MS)
  }, [session])

  const startRound = useCallback((index: number) => {
    setRoundIndex(index)
    setPositionSize(0.25)
    setBuyVenue(null)
    setSellVenue(null)
    setFeedbackRemainingMs(FEEDBACK_MS)
    setElapsedMs(0)
    startRef.current = Date.now()
    committedRef.current = false
    setStage('market')
  }, [])

  useEffect(() => {
    if (stage !== 'market') return
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startRef.current)
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [stage, roundIndex])

  const commit = useCallback(
    (decision: { buyVenue?: string; sellVenue?: string; positionSize: number }, timedOut: boolean) => {
      if (committedRef.current) return
      committedRef.current = true

      const elapsed = Date.now() - startRef.current
      timedOut = timedOut || (!timerDisabled && elapsed >= limitMs)
      if (timedOut) decision = { positionSize: 0 }
      const decisionTimeMs = timedOut ? limitMs : elapsed
      const round = evaluateRound(scenario, { ...decision, decisionTimeMs, timedOut })

      setRounds((current) => [...current, round])
      setStage('feedback')

      trackEvent('cross_arbitrage_round', {
        sessionId: session.id,
        scenarioId: scenario.id,
        kind: scenario.kind,
        choseNoTrade: round.choseNoTrade,
        timedOut,
        capitalReturn: Number((round.capitalReturn * 100).toFixed(3)),
        decisionTimeMs,
      })
    },
    [limitMs, scenario, session.id, timerDisabled],
  )

  // Если время вышло, сделка просто не открывается. Это не поражение.
  useEffect(() => {
    if (stage === 'market' && !timerDisabled && elapsedMs >= limitMs) {
      commit({ positionSize: 0 }, true)
    }
  }, [commit, elapsedMs, limitMs, stage, timerDisabled])

  useEffect(() => {
    if (stage !== 'feedback') return
    // The display samples the same deadline as the existing transition timeout.
    const deadline = performance.now() + FEEDBACK_MS
    let frame: number
    const updateCountdown = () => {
      const remaining = Math.max(0, deadline - performance.now())
      setFeedbackRemainingMs(remaining)
      if (remaining > 0) frame = requestAnimationFrame(updateCountdown)
    }
    frame = requestAnimationFrame(updateCountdown)
    const timeout = window.setTimeout(() => {
      if (rounds.length >= scenarios.length) {
        onCompleteRef.current(buildCrossArbitrageResult(session, rounds))
        return
      }
      startRound(rounds.length)
    }, FEEDBACK_MS)
    return () => { window.clearTimeout(timeout); cancelAnimationFrame(frame) }
  }, [rounds, scenarios.length, session, stage, startRound])

  if (stage === 'intro') {
    const seconds = scenarios.map(item => item.durationSeconds || ARB_DECISION_SECONDS)
    const venues = scenarios.map(item => item.quotes.length)
    const range = (values: number[]) => Math.min(...values) === Math.max(...values) ? String(values[0]) : `${Math.min(...values)}–${Math.max(...values)}`
    const venueCount = range(venues)
    const chartNote = venueCount === '3' ? 'Пример двух из трёх площадок'
      : venueCount === '5' ? 'Пример двух из пяти площадок' : 'Пример сравнения двух площадок'
    return <ChallengeIntro number="04" title={<>Кросс-<br />арбитраж</>}
      subtitle="Один актив. Разные цены. Ограниченное время."
      description="Найдите расхождение цен между площадками. Выберите, где купить и продать актив, учитывая комиссии и доступный объём. Если сделка невыгодна — пропустите её."
      stats={[
        { value: scenarios.length, label: 'торговых раундов' },
        { value: timerDisabled ? 'Без лимита' : `${range(seconds)} с`, label: 'на решение' },
        { value: venueCount, label: venueCount === '5' ? 'торговых площадок' : 'торговые площадки' },
      ]}
      note="Капитал уже размещён на площадках. Переводы между ними не учитываются. Вы можете отказаться от сделки."
      cta="Открыть площадки" visual={<ChallengeIllustration kind="cross-arbitrage" chartNote={chartNote} />}
      mode={context?.mode ?? session.mode ?? 'standard'} state={stage}
      onStart={() => { trackEvent('scenario_started', { challengeType: 'cross-arbitrage', scenarioId: session.id, mode: session.mode }); startRound(0) }} />
  }

  const remaining = Math.max(0, Math.ceil((limitMs - elapsedMs) / 1000))
  const lastRound = rounds.at(-1)

  const selectBuy = (venueId: string) => {
    setBuyVenue(venueId)
    if (sellVenue === venueId) setSellVenue(null)
  }

  return <div className="arb-terminal"><div className="site-container arb-workspace">
    <header className="arb-topbar">
      <div><p>Раунд {String(roundIndex + 1).padStart(2, '0')} / {String(scenarios.length).padStart(2, '0')}</p><h1>{scenario.asset}</h1></div>
      {stage === 'market' && (timerDisabled ? <span>Без лимита времени</span> : <RoundClock remaining={remaining} total={limitMs / 1000} />)}
    </header>
    <div className="arb-columns">
      <QuoteBoard quotes={stage === 'feedback' && lastRound ? path[lastRound.quoteStep] : quotes}
        buyVenue={buyVenue} sellVenue={sellVenue} converging={stage === 'market' && step > 0} />
      {stage === 'feedback' && lastRound ? <RoundFeedback round={lastRound} scenario={scenario}
          remainingMs={feedbackRemainingMs} durationMs={FEEDBACK_MS} finalRound={rounds.length === scenarios.length} />
        : <TradeTicket quotes={quotes} buyVenue={buyVenue} sellVenue={sellVenue} positionSize={positionSize}
            onBuy={selectBuy} onSell={setSellVenue} onSize={setPositionSize}
            onExecute={() => { if (buyVenue && sellVenue) commit({ buyVenue, sellVenue, positionSize }, false) }}
            onSkip={() => commit({ positionSize: 0 }, false)} />}
    </div>
  </div></div>
}
