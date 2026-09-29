import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Ban, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { sessionScenarios } from '@/data/crossArbitrageScenarios'
import { trackEvent } from '@/lib/analytics'
import { formatNumber, formatPrice, pnlColor } from '@/lib/formatting'
import type {
  ArbitrageRoundResult,
  ArbitrageVenueQuote,
  CrossArbitrageResult,
  CrossArbitrageSession,
} from '@/types/game'
import {
  ARB_DECISION_SECONDS,
  ARB_FULL_SIZE_UNITS,
  ARB_POSITION_SIZES,
  buildQuotePath,
  quoteStepAt,
} from './engine'
import {
  buildCrossArbitrageResult,
  evaluateRound,
  formatEdge,
  roundFeedback,
  sizeLabel,
  type RoundFeedback,
} from './scoring'

type Stage = 'intro' | 'market' | 'feedback'

const FEEDBACK_MS = 1500
const TICK_MS = 200

export function CrossArbitrageGame({
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
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null)

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
  const previousQuotes = step > 0 ? path[step - 1] : null

  useEffect(() => {
    setStage('intro')
    setRoundIndex(0)
    setRounds([])
    setFeedback(null)
  }, [session])

  const startRound = useCallback((index: number) => {
    setRoundIndex(index)
    setPositionSize(0.25)
    setBuyVenue(null)
    setSellVenue(null)
    setFeedback(null)
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
      setFeedback(roundFeedback(round, scenario))
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
    const timeout = window.setTimeout(() => {
      if (rounds.length >= scenarios.length) {
        onCompleteRef.current(buildCrossArbitrageResult(session, rounds))
        return
      }
      startRound(rounds.length)
    }, FEEDBACK_MS)
    return () => window.clearTimeout(timeout)
  }, [rounds, scenarios.length, session, stage, startRound])

  if (stage === 'intro') {
    return <Intro seconds={scenarios[0].durationSeconds} marketCount={scenarios.length} onStart={() => { trackEvent('scenario_started', { challengeType: 'cross-arbitrage', scenarioId: session.id, mode: session.mode }); startRound(0) }} />
  }

  const remaining = Math.max(0, Math.ceil((limitMs - elapsedMs) / 1000))
  const canPickSize = Boolean(buyVenue && sellVenue)

  const selectBuy = (venueId: string) => {
    setBuyVenue(venueId)
    if (sellVenue === venueId) setSellVenue(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <span className="tnum text-sm text-chalk-500">
            Рынок {roundIndex + 1} / {scenarios.length}
          </span>
          <span className="text-2xl font-light tracking-tight text-chalk-50">
            {scenario.asset}
          </span>
        </div>
        {stage === 'market' && !timerDisabled ? (
          <Countdown remaining={remaining} total={limitMs / 1000} />
        ) : null}
      </header>

      <QuoteBoard
        quotes={quotes}
        previous={previousQuotes}
        converging={step > 0}
        buyVenue={buyVenue}
        sellVenue={sellVenue}
      />

      {stage === 'feedback' && feedback ? (
        <FeedbackCard feedback={feedback} round={rounds.at(-1)!} />
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border border-ink-700 bg-ink-900 p-5 sm:p-6">
          <VenueRow
            title="Где купить?"
            hint="Покупка идёт по ask"
            quotes={quotes}
            side="buy"
            selected={buyVenue}
            onSelect={selectBuy}
          />
          <VenueRow
            title="Где продать?"
            hint="Продажа идёт по bid"
            quotes={quotes}
            side="sell"
            selected={sellVenue}
            disabledVenue={buyVenue}
            onSelect={setSellVenue}
          />

          {canPickSize ? (
            <SizePicker
              quotes={quotes}
              buyVenue={buyVenue as string}
              sellVenue={sellVenue as string}
              selected={positionSize}
              onPick={setPositionSize}
            />
          ) : null}

          <div className="flex flex-col gap-3 border-t border-ink-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-chalk-500">
              Если чистой прибыли после комиссий нет — сделку можно не открывать.
            </p>
            <Button
              variant="primary"
              size="lg"
              disabled={!canPickSize || buyVenue === sellVenue}
              onClick={() => commit({ buyVenue: buyVenue!, sellVenue: sellVenue!, positionSize }, false)}
            >
              Исполнить сделку
            </Button>
            <Button
              size="lg"
              className="shrink-0"
              onClick={() => commit({ positionSize: 0 }, false)}
            >
              <Ban className="h-4 w-4" aria-hidden />
              Сделки нет
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Intro({ seconds, marketCount, onStart }: { seconds: number; marketCount: number; onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 04</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Кросс-арбитраж
        </h1>
      </div>

      <p className="text-lg leading-relaxed font-medium text-chalk-50">
        Один актив торгуется на нескольких площадках. Найди расхождение, которое остаётся прибыльным после комиссий и исполнения.
      </p>
      <p className="text-base leading-relaxed font-medium text-chalk-200">
        Покупка идёт по Ask. Продажа — по Bid. Не каждое расхождение является сделкой.
      </p>

      <p className="text-sm leading-relaxed text-chalk-400">
        Считай, что капитал уже размещён на всех площадках. Переводы между ними не учитываются.
        Объём сверх лучшей котировки исполняется по следующим уровням, показанным в таблице.
      </p>
      <p className="text-xs leading-relaxed text-chalk-500">
        {marketCount} рынков подряд, на каждый — {seconds} секунд. Если время
        закончится, сделка просто не откроется — это не проигрыш.
      </p>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Начать
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function Countdown({ remaining, total }: { remaining: number; total: number }) {
  const urgent = remaining <= 5

  return (
    <div className="flex items-center gap-3">
      <span className={`tnum text-sm ${urgent ? 'text-market-down' : 'text-chalk-400'}`}>
        {remaining} с
      </span>
      <div className="h-0.5 w-24 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            urgent ? 'bg-market-down' : 'bg-chalk-500'
          }`}
          style={{ width: `${(remaining / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

function QuoteBoard({
  quotes,
  previous,
  converging,
  buyVenue,
  sellVenue,
}: {
  quotes: ArbitrageVenueQuote[]
  previous: ArbitrageVenueQuote[] | null
  converging: boolean
  buyVenue: string | null
  sellVenue: string | null
}) {
  const hasLiquidity = true
  const columns = hasLiquidity
    ? 'grid-cols-[1.1fr_1fr_1fr_0.9fr_0.9fr]'
    : 'grid-cols-[1.1fr_1fr_1fr_0.9fr]'

  return (
    <section className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
      <div className="overflow-x-auto">
        <div className={hasLiquidity ? 'min-w-[520px]' : 'min-w-[420px]'}>
          <div
            className={`grid ${columns} gap-3 border-b border-ink-800 px-4 py-3 text-[11px] tracking-[0.14em] text-chalk-500 uppercase sm:px-6`}
          >
            <span>Площадка</span>
            <span className="text-right">Bid</span>
            <span className="text-right">Ask</span>
            <span className="text-right">Комиссия</span>
            {hasLiquidity ? <span className="text-right">Доступно Bid / Ask</span> : null}
          </div>

          {quotes.map((quote) => {
            const before = previous?.find((item) => item.venueId === quote.venueId)
            const role =
              quote.venueId === buyVenue ? 'buy' : quote.venueId === sellVenue ? 'sell' : null
            return (
              <div
                key={quote.venueId}
                className={`grid ${columns} items-baseline gap-3 border-b border-ink-800 px-4 py-3.5 last:border-b-0 sm:px-6 ${
                  role ? 'bg-violet-dim/20' : ''
                }`}
              >
                <span className="flex items-baseline gap-2 text-base text-chalk-50">
                  {quote.venueName}
                  {role ? (
                    <span className="text-[10px] tracking-[0.14em] text-violet-soft uppercase">
                      {role === 'buy' ? 'покупка' : 'продажа'}
                    </span>
                  ) : null}
                </span>
                <PriceCell value={quote.bid} before={before?.bid} emphasized={role === 'sell'} />
                <PriceCell value={quote.ask} before={before?.ask} emphasized={role === 'buy'} />
                <span className="tnum text-right text-sm text-chalk-400">
                  {formatNumber(quote.feeRate * 100, 2)}%
                </span>
                {hasLiquidity ? (
                  <span className="tnum text-right text-sm text-chalk-400">
                    {quote.bidLiquidity} / {quote.askLiquidity} ед.
                  </span>
                ) : null}
                {(quote.secondBidLiquidity ?? 0) + (quote.secondAskLiquidity ?? 0) > 0 ? <span className="col-span-5 text-xs text-chalk-500">
                  Второй уровень: Bid {formatPrice(quote.secondBid ?? quote.bid)} · {quote.secondBidLiquidity ?? 0} ед.
                  {' / '}Ask {formatPrice(quote.secondAsk ?? quote.ask)} · {quote.secondAskLiquidity ?? 0} ед.
                </span> : null}
                {quote.thirdBid !== undefined && <span className="col-span-5 text-xs text-chalk-500">Третий уровень: покупка {formatPrice(quote.thirdAsk!)} · {quote.thirdAskLiquidity} ед. / продажа {formatPrice(quote.thirdBid)} · {quote.thirdBidLiquidity} ед.</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 px-4 py-2.5 text-xs text-chalk-500 sm:px-6">
        <span>Bid — площадка купит у тебя. Ask — ты купишь у площадки.</span>
        {converging ? (
          <span className="flex animate-fade items-center gap-1.5 text-market-down">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            Расхождение сокращается
          </span>
        ) : null}
      </div>
    </section>
  )
}

function PriceCell({
  value,
  emphasized,
}: {
  value: number
  before?: number
  emphasized: boolean
}) {

  return (
    <span
      key={value}
      className={`tnum rounded px-1 text-right text-base ${
        emphasized ? 'text-chalk-50' : 'text-chalk-200'
      }`}
    >
      {formatPrice(value)}
    </span>
  )
}

function VenueRow({
  title,
  hint,
  quotes,
  side,
  selected,
  disabledVenue,
  onSelect,
}: {
  title: string
  hint: string
  quotes: ArbitrageVenueQuote[]
  side: 'buy' | 'sell'
  selected: string | null
  disabledVenue?: string | null
  onSelect: (venueId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-normal tracking-tight text-chalk-50">{title}</h2>
        <span className="text-xs text-chalk-500">{hint}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {quotes.map((quote) => {
          const isSelected = selected === quote.venueId
          const disabled = disabledVenue === quote.venueId
          return (
            <button
              key={quote.venueId}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(quote.venueId)}
              className={`flex min-h-20 min-w-0 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-3 text-left sm:px-4 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 ${
                isSelected
                  ? 'border-violet-accent bg-violet-accent/10'
                  : 'border-ink-700 bg-ink-950 hover:border-violet-accent/60'
              }`}
            >
              <span className="text-sm text-chalk-400">{quote.venueName}</span>
              <span className="tnum text-[15px] leading-tight text-chalk-50 sm:text-lg">
                {formatPrice(side === 'buy' ? quote.ask : quote.bid)}
              </span>
              <span className="tnum text-[11px] text-chalk-500">
                комиссия {formatNumber(quote.feeRate * 100, 2)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SizePicker({
  quotes,
  buyVenue,
  sellVenue,
  selected,
  onPick,
}: {
  quotes: ArbitrageVenueQuote[]
  buyVenue: string
  sellVenue: string
  selected: number
  onPick: (size: number) => void
}) {
  const buy = quotes.find((quote) => quote.venueId === buyVenue) as ArbitrageVenueQuote
  const sell = quotes.find((quote) => quote.venueId === sellVenue) as ArbitrageVenueQuote
  const difference = ((sell.bid - buy.ask) / buy.ask) * 100
  const liquidity = Math.min(buy.askLiquidity, sell.bidLiquidity)

  return (
    <div className="flex animate-fade-up flex-col gap-4 border-t border-ink-800 pt-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Summary label="Маршрут" value={`${buy.venueName} → ${sell.venueName}`} />
        <Summary
          label="Разница в цене"
          value={formatEdge(difference)}
          valueClass={pnlColor(difference)}
        />
        <Summary
          label="Комиссии"
          value={`${formatNumber(buy.feeRate * 100, 2)}% + ${formatNumber(sell.feeRate * 100, 2)}%`}
        />
      </div>

      <p className="text-xs text-chalk-400">
        Доступно по лучшей цене: {buy.venueName} Ask — {buy.askLiquidity} ед.; {sell.venueName} Bid — {sell.bidLiquidity} ед.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-normal tracking-tight text-chalk-50">Размер сделки</h2>
          {liquidity !== null ? (
            <span className="text-xs text-chalk-500">
              По котировке доступно {liquidity} ед. — остальное исполнится хуже
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ARB_POSITION_SIZES.map((size) => {
            const units = size * ARB_FULL_SIZE_UNITS
            const overLimit = liquidity !== null && units > liquidity
            return (
              <button
                key={size}
                type="button"
                aria-pressed={selected === size}
                onClick={() => onPick(size)}
                className={` ${selected === size ? 'ring-2 ring-violet-accent' : ''} tnum flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-ink-700 bg-ink-950 text-chalk-50 transition-colors duration-150 hover:border-violet-accent hover:bg-violet-accent/10`}
              >
                <span className="text-base font-medium">{sizeLabel(size)}</span>
                <span
                  className={`text-[11px] ${overLimit ? 'text-market-down' : 'text-chalk-500'}`}
                >
                  {overLimit ? (buy.thirdAsk !== undefined || sell.thirdBid !== undefined ? 'Часть по глубине' : 'Часть на втором уровне') : 'По лучшей цене'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Summary({
  label,
  value,
  valueClass = 'text-chalk-50',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">{label}</span>
      <span className={`tnum text-base ${valueClass}`}>{value}</span>
    </div>
  )
}

function FeedbackCard({ feedback, round }: { feedback: RoundFeedback; round: ArbitrageRoundResult }) {
  return (
    <div className="flex animate-fade-up flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
      <span className={`tnum text-4xl font-light ${pnlColor(Number(feedback.valuePercent.toFixed(2)))}`}>
        {formatEdge(feedback.valuePercent)}
      </span>
      <span className="text-lg text-chalk-50">{feedback.title}</span>
      {feedback.detail ? (
        <span className="text-sm text-chalk-400">{feedback.detail}</span>
      ) : null}
      <ExecutionBreakdown round={round} />
      <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-violet-accent/70"
          style={{ animation: `mt-fill ${FEEDBACK_MS}ms linear both` }}
        />
      </div>
    </div>
  )
}


export function ExecutionBreakdown({ round }: { round: ArbitrageRoundResult }) {
  if (round.choseNoTrade) return null
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-chalk-400">
      <span>Gross spread {formatEdge(round.grossReturn * 100)}</span>
      <span>Комиссии {formatEdge(-(round.feeReturn ?? round.grossReturn - round.netBeforeLiquidity) * 100)}</span>
      <span>Slippage {formatEdge(-(round.slippageReturn ?? round.netBeforeLiquidity - round.netReturn) * 100)}</span>
      <span>Net result {formatEdge(round.netReturn * 100)}</span>
      {round.avgBuyPrice !== undefined && round.avgSellPrice !== undefined ? (
        <span>Среднее исполнение: покупка {formatPrice(round.avgBuyPrice)} → продажа {formatPrice(round.avgSellPrice)}</span>
      ) : null}
    </div>
  )
}
