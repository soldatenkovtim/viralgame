import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Shield,
} from 'lucide-react'
import { QuoteChart } from '@/components/charts/QuoteChart'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import { MM_TICK_MS } from '@/data/marketMakerScenarios'
import { formatMoney, formatPrice, formatSigned, pnlColor } from '@/lib/formatting'
import type { MarketMakerResult, MarketMakerScenario } from '@/types/game'
import { MarketMakerEngine, type MarketMakerSnapshot } from './engine'

type Stage = 'intro' | 'running' | 'finished'

export function MarketMakerGame({
  scenario,
  onComplete,
}: {
  scenario: MarketMakerScenario
  onComplete: (result: MarketMakerResult) => void
}) {
  const [stage, setStage] = useState<Stage>('intro')
  const [snapshot, setSnapshot] = useState<MarketMakerSnapshot | null>(null)
  const [hedgeFlash, setHedgeFlash] = useState(false)

  const engineRef = useRef<MarketMakerEngine | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    setStage('intro')
    setSnapshot(null)
    engineRef.current = null
  }, [scenario])

  useEffect(() => {
    if (stage !== 'running') return

    const engine = new MarketMakerEngine(scenario)
    engineRef.current = engine
    setSnapshot(engine.snapshot())

    const interval = window.setInterval(() => {
      const next = engine.tick()
      setSnapshot(next)

      if (next.finished) {
        window.clearInterval(interval)
        setStage('finished')
        onCompleteRef.current(engine.buildResult())
      }
    }, MM_TICK_MS)

    return () => window.clearInterval(interval)
  }, [stage, scenario])

  const sync = useCallback(() => {
    const engine = engineRef.current
    if (engine) setSnapshot(engine.snapshot())
  }, [])

  const handleHedge = () => {
    const engine = engineRef.current
    if (!engine) return
    const closed = engine.hedge()
    if (closed !== 0) {
      setHedgeFlash(true)
      window.setTimeout(() => setHedgeFlash(false), 600)
    }
    sync()
  }

  if (stage === 'intro') {
    return <Intro onStart={() => setStage('running')} durationSeconds={scenario.durationSeconds} />
  }

  if (!snapshot) return null

  const progress = snapshot.tick / snapshot.totalTicks
  const recentTrades = snapshot.trades.slice(-6).reverse()

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-6">
        <span className="text-sm text-chalk-400">Ты котируешь рынок</span>
        <div className="flex items-center gap-4">
          <span className="tnum text-sm text-chalk-200">{snapshot.secondsLeft} с</span>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-ink-700 sm:w-48">
            <div
              className="h-full rounded-full bg-violet-accent transition-[width] duration-700 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <div
            className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 ${
              hedgeFlash ? 'animate-pulse-ring' : ''
            }`}
          >
            <div className="flex flex-col gap-2 bg-ink-900 px-6 py-6">
              <span className="text-[11px] tracking-[0.18em] text-chalk-500 uppercase">
                Bid
              </span>
              <span className="tnum text-4xl leading-none font-light text-market-up sm:text-5xl">
                {formatPrice(snapshot.bid)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-2 bg-ink-900 px-6 py-6">
              <span className="text-[11px] tracking-[0.18em] text-chalk-500 uppercase">
                Ask
              </span>
              <span className="tnum text-4xl leading-none font-light text-market-down sm:text-5xl">
                {formatPrice(snapshot.ask)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <QuoteChart quotes={snapshot.quoteHistory} trades={snapshot.trades} />
          </div>

          <Controls
            onLower={() => {
              engineRef.current?.moveQuotes(-1)
              sync()
            }}
            onHigher={() => {
              engineRef.current?.moveQuotes(1)
              sync()
            }}
            onNarrow={() => {
              engineRef.current?.narrowSpread()
              sync()
            }}
            onWiden={() => {
              engineRef.current?.widenSpread()
              sync()
            }}
            onHedge={handleHedge}
            hedgeDisabled={snapshot.inventory === 0}
            spread={snapshot.spread}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <Metric
              label="Inventory"
              value={formatSigned(snapshot.inventory)}
              valueClass={
                Math.abs(snapshot.inventory) >= 10 ? 'text-market-down' : 'text-chalk-50'
              }
            />
            <Metric
              label="PnL"
              value={formatMoney(snapshot.pnl)}
              valueClass={pnlColor(snapshot.pnl)}
            />
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5">
            <SectionLabel>Последние сделки</SectionLabel>
            {recentTrades.length === 0 ? (
              <p className="text-sm text-chalk-500">Сделок пока не было.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {recentTrades.map((trade) => (
                  <li
                    key={`${trade.tick}-${trade.price}`}
                    className="tnum flex items-baseline justify-between text-sm"
                  >
                    <span className="text-chalk-400">
                      Бот {trade.botSide === 'buy' ? 'купил' : 'продал'} {trade.size}
                    </span>
                    <span
                      className={
                        trade.botSide === 'buy' ? 'text-market-down' : 'text-market-up'
                      }
                    >
                      {formatPrice(trade.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs leading-relaxed text-chalk-500">
            Справедливая цена скрыта. Всё, что у тебя есть, — собственная котировка и
            поток сделок.
          </p>
        </aside>
      </div>
    </div>
  )
}

function Intro({
  onStart,
  durationSeconds,
}: {
  onStart: () => void
  durationSeconds: number
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <SectionLabel>Испытание 02</SectionLabel>
        <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
          Маркет-мейкер
        </h1>
      </div>

      <div className="flex flex-col gap-4 text-base leading-relaxed text-chalk-200">
        <p>
          Ты выставляешь двустороннюю котировку. Кто-то торгует против тебя — но кто
          именно, станет понятно только в конце.
        </p>
        <p>
          Твой заработок — спред. Твой риск — накопленный инвентарь.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-chalk-400">
        <li>Двигай котировку целиком или меняй ширину спреда</li>
        <li>Хедж закрывает весь инвентарь, но стоит денег</li>
        <li className="tnum">Раунд длится {durationSeconds} секунд</li>
      </ul>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Открыть котировку
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

function Metric({
  label,
  value,
  valueClass = 'text-chalk-50',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
      <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">
        {label}
      </span>
      <span className={`tnum text-3xl leading-none font-light ${valueClass}`}>{value}</span>
    </div>
  )
}

function Controls({
  onLower,
  onHigher,
  onNarrow,
  onWiden,
  onHedge,
  hedgeDisabled,
  spread,
}: {
  onLower: () => void
  onHigher: () => void
  onNarrow: () => void
  onWiden: () => void
  onHedge: () => void
  hedgeDisabled: boolean
  spread: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ControlGroup label="Двигать рынок">
        <ControlButton onClick={onLower}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Ниже
        </ControlButton>
        <ControlButton onClick={onHigher}>
          Выше
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ControlButton>
      </ControlGroup>

      <ControlGroup label={`Спред · ${formatPrice(spread)}`}>
        <ControlButton onClick={onNarrow}>
          <ChevronsRightLeft className="h-4 w-4" aria-hidden />
          Сузить
        </ControlButton>
        <ControlButton onClick={onWiden}>
          <ChevronsLeftRight className="h-4 w-4" aria-hidden />
          Расширить
        </ControlButton>
      </ControlGroup>

      <ControlGroup label="Риск">
        <ControlButton onClick={onHedge} disabled={hedgeDisabled} accent wide>
          <Shield className="h-4 w-4" aria-hidden />
          Хеджировать
        </ControlButton>
      </ControlGroup>
    </div>
  )
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}

function ControlButton({
  children,
  onClick,
  disabled,
  accent,
  wide,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${wide ? '' : 'sm:col-span-1'} ${
        accent
          ? 'border-violet-accent/40 bg-violet-accent/10 text-violet-soft hover:bg-violet-accent/18'
          : 'border-ink-700 bg-ink-900 text-chalk-200 hover:border-ink-500 hover:bg-ink-850'
      }`}
    >
      {children}
    </button>
  )
}
