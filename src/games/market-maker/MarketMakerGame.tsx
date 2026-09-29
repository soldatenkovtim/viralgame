import { trackEvent } from '@/lib/analytics'
import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Shield,
} from 'lucide-react'
import { QuoteChart, QuoteLegend } from '@/components/charts/QuoteChart'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/Card'
import {
  MM_HARD_INVENTORY_LIMIT,
  MM_SOFT_INVENTORY_LIMIT,
  MM_TICK_MS,
} from '@/data/marketMakerScenarios'
import { formatMoney, formatPrice, formatSigned, pnlColor } from '@/lib/formatting'
import type { MarketMakerResult, MarketMakerScenario, MMTrade } from '@/types/game'
import { MarketMakerEngine, type MarketMakerSnapshot } from './engine'

type Stage = 'intro' | 'running' | 'finished'

const RECENT_TRADES = 8

export function MarketMakerGame({
  scenario,
  onComplete,
}: {
  context?: ChallengeContext
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

  const act = useCallback((action: (engine: MarketMakerEngine) => void) => {
    const engine = engineRef.current
    if (!engine) return
    action(engine)
    setSnapshot(engine.snapshot())
  }, [])

  const handleHedge = useCallback(() => {
    act((engine) => {
      if (engine.hedge() !== 0) {
        setHedgeFlash(true)
        window.setTimeout(() => setHedgeFlash(false), 600)
      }
    })
  }, [act])

  useEffect(() => {
    if (stage !== 'running') return
    const onKey = (event: KeyboardEvent) => {
      const handlers: Record<string, () => void> = {
        ArrowLeft: () => act((engine) => engine.moveQuotes(-1)),
        ArrowRight: () => act((engine) => engine.moveQuotes(1)),
        ArrowDown: () => act((engine) => engine.narrowSpread()),
        ArrowUp: () => act((engine) => engine.widenSpread()),
        KeyH: handleHedge,
      }
      const handler = handlers[event.code]
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, act, handleHedge])

  if (stage === 'intro') {
    return <Intro advanced={scenario.mode === 'advanced'} onStart={() => { trackEvent('scenario_started', { challengeType: 'market-maker', scenarioId: scenario.id, mode: scenario.mode }); setStage('running') }} durationSeconds={scenario.durationSeconds} />
  }

  if (!snapshot) return null

  const progress = snapshot.tick / snapshot.totalTicks
  const recentTrades = snapshot.trades.slice(-RECENT_TRADES).reverse()

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-6">
        <span className="text-sm text-chalk-400">Ты котируешь рынок</span>
        <div className="flex items-center gap-4">
          <span className="tnum text-sm text-chalk-200">{snapshot.secondsLeft} с</span>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-ink-700 sm:w-48">
            <div
              className="h-full rounded-full bg-violet-accent transition-[width] duration-500 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <div
            className={`grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 ${
              hedgeFlash ? 'animate-pulse-ring' : ''
            }`}
          >
            <QuoteCell label="Bid" value={snapshot.bid} className="text-market-up" />
            <QuoteCell
              label="Рыночная цена"
              value={snapshot.marketPrice}
              className="text-chalk-200"
              align="center"
              small
            />
            <QuoteCell label="Ask" value={snapshot.ask} className="text-market-down" align="end" />
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <QuoteChart
              points={snapshot.history}
              trades={snapshot.trades}
              totalTicks={snapshot.totalTicks}
            />
            <QuoteLegend />
          </div>

          <Controls
            onLower={() => act((engine) => engine.moveQuotes(-1))}
            onHigher={() => act((engine) => engine.moveQuotes(1))}
            onNarrow={() => act((engine) => engine.narrowSpread())}
            onWiden={() => act((engine) => engine.widenSpread())}
            onHedge={handleHedge}
            hedgeDisabled={snapshot.inventory === 0}
            hedgeCost={snapshot.hedgeCostPreview}
            spread={snapshot.spread}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <InventoryCard softLimit={scenario.softInventoryLimit} inventory={snapshot.inventory} />
            <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4">
              <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">PnL</span>
              <span className={`tnum text-3xl leading-none font-light ${pnlColor(snapshot.pnl)}`}>
                {formatMoney(snapshot.pnl)}
              </span>
            </div>
          </div>

          <RecentTrades trades={recentTrades} />

          <p className="text-xs leading-relaxed text-chalk-500">
            Справедливая цена скрыта. У тебя есть рыночная цена, собственная котировка и
            поток сделок. Клавиши: ← → сдвиг, ↓ ↑ спред, H — хедж.
          </p>
        </aside>
      </div>
    </div>
  )
}

function QuoteCell({
  label,
  value,
  className,
  align = 'start',
  small = false,
}: {
  label: string
  value: number
  className: string
  align?: 'start' | 'center' | 'end'
  small?: boolean
}) {
  const alignment = { start: 'items-start', center: 'items-center', end: 'items-end' }[align]
  return (
    <div className={`flex flex-col justify-between gap-2 bg-ink-900 px-4 py-5 sm:px-6 ${alignment}`}>
      <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">{label}</span>
      <span
        className={`tnum leading-none font-light ${className} ${
          small ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'
        }`}
      >
        {formatPrice(value)}
      </span>
    </div>
  )
}

function riskLevel(inventory: number, softLimit: number): { label: string; className: string } {
  const size = Math.abs(inventory)
  if (size > MM_HARD_INVENTORY_LIMIT) return { label: 'сверх лимита', className: 'text-market-down' }
  if (size > softLimit) return { label: 'повышенный', className: 'text-risk' }
  if (size >= 8) return { label: 'умеренный', className: 'text-chalk-200' }
  return { label: 'низкий', className: 'text-chalk-400' }
}

function InventoryCard({ inventory, softLimit = MM_SOFT_INVENTORY_LIMIT }: { inventory: number; softLimit?: number }) {
  const risk = riskLevel(inventory, softLimit)
  const scale = MM_HARD_INVENTORY_LIMIT + 5
  const position = ((Math.max(-scale, Math.min(scale, inventory)) + scale) / (scale * 2)) * 100
  const softOffset = (softLimit / (scale * 2)) * 100
  const hardOffset = (MM_HARD_INVENTORY_LIMIT / (scale * 2)) * 100
  const aboveSoft = Math.abs(inventory) > softLimit
  const aboveHard = Math.abs(inventory) > MM_HARD_INVENTORY_LIMIT

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-ink-900 px-5 py-4 transition-colors duration-300 ${
        aboveHard
          ? 'border-market-down/60'
          : aboveSoft
            ? 'border-risk/45'
            : 'border-ink-700'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">Inventory</span>
        <span className="text-xs text-chalk-500">
          Риск: <span className={risk.className}>{risk.label}</span>
        </span>
      </div>
      <span
        className={`tnum text-3xl leading-none font-light ${
          aboveSoft ? risk.className : 'text-chalk-50'
        }`}
      >
        {formatSigned(inventory)}
      </span>

      <div className="relative h-3" aria-hidden>
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-ink-600" />
        {[-hardOffset, -softOffset, softOffset, hardOffset].map((offset) => (
          <div
            key={offset}
            className={`absolute top-0.5 h-2 w-px ${
              Math.abs(offset) === hardOffset ? 'bg-market-down/60' : 'bg-risk/50'
            }`}
            style={{ left: `${50 + offset}%` }}
          />
        ))}
        <div className="absolute top-0 left-1/2 h-3 w-px bg-ink-500" />
        <div
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-300 ${
            aboveHard ? 'bg-market-down' : aboveSoft ? 'bg-risk' : 'bg-chalk-200'
          }`}
          style={{ left: `${position}%` }}
        />
      </div>

      <p
        className={`text-xs leading-snug transition-opacity duration-300 ${
          aboveSoft ? 'opacity-100' : 'opacity-0'
        } ${aboveHard ? 'text-market-down' : 'text-risk/90'}`}
        aria-live="polite"
        aria-hidden={!aboveSoft}
      >
        {aboveHard
          ? 'Позиция сверх лимита переоценивается с дисконтом'
          : 'Позиционный риск растёт'}
      </p>
    </div>
  )
}

function RecentTrades({ trades }: { trades: MMTrade[] }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5">
      <SectionLabel>Последние сделки</SectionLabel>
      {trades.length === 0 ? (
        <p className="text-sm text-chalk-500">Сделок пока не было.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {trades.map((trade) => (
            <li
              key={`${trade.tick}-${trade.botSide}`}
              className={`tnum flex items-baseline justify-between gap-3 rounded-md border-l-2 px-2.5 py-1 text-sm ${
                trade.increasedRisk
                  ? 'border-risk/60 bg-risk/[0.04] text-chalk-200'
                  : 'border-transparent text-chalk-400'
              }`}
            >
              <span>
                {trade.botSide === 'buy' ? 'Купили' : 'Продали'} {trade.size}
              </span>
              <span className={trade.botSide === 'buy' ? 'text-market-down' : 'text-market-up'}>
                @ {formatPrice(trade.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-2 text-[11px] leading-snug text-chalk-500">
        Выделены сделки, которые увеличили inventory.
      </p>
    </div>
  )
}

function Intro({
  advanced,
  onStart,
  durationSeconds,
}: {
  advanced: boolean
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
          Ты выставляешь двустороннюю котировку вокруг рынка. Справедливая цена скрыта —
          её выдают только рыночная цена и поток сделок.
        </p>
        <p>
          Узкий спред приносит больше сделок, широкий — защищает. Заработок — спред, риск —
          накопленный inventory.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-chalk-400">
        {advanced && <li>Хедж на 20% дороже. Позиция свыше 12 лотов несёт дополнительные издержки удержания.</li>}
        <li>Смещай котировку целиком или меняй ширину спреда</li>
        <li>Inventory переоценивается по рынку в каждый момент</li>
        <li>Хедж закрывает весь inventory, но стоит денег</li>
        <li className="tnum">Раунд длится {durationSeconds} секунд</li>
      </ul>

      <Button variant="primary" size="lg" className="self-start" onClick={onStart}>
        Открыть котировку
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
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
  hedgeCost,
  spread,
}: {
  onLower: () => void
  onHigher: () => void
  onNarrow: () => void
  onWiden: () => void
  onHedge: () => void
  hedgeDisabled: boolean
  hedgeCost: number
  spread: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ControlGroup label="Сместить котировки">
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

      <ControlGroup label={hedgeDisabled ? 'Риск' : `Риск · хедж ${formatMoney(-hedgeCost)}`}>
        <ControlButton onClick={onHedge} disabled={hedgeDisabled} accent wide>
          <Shield className="h-4 w-4" aria-hidden />
          Хеджировать
        </ControlButton>
      </ControlGroup>
    </div>
  )
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="tnum text-[11px] tracking-[0.14em] text-chalk-500 uppercase">{label}</span>
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
  children: ReactNode
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
