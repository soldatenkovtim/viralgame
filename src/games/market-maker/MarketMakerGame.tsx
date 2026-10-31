import { ChallengeIntro } from '@/components/challenge/ChallengeIntro'
import { ChallengeIllustration } from '@/components/challenge/ChallengeIllustration'
import { trackEvent } from '@/lib/analytics'
import type { ChallengeContext } from '@/modes/config'
import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { QuoteChart, QuoteLegend } from '@/components/charts/QuoteChart'
import { SectionLabel } from '@/components/ui/Card'
import {
  MM_HARD_INVENTORY_LIMIT,
  MM_MIN_SPREAD,
  MM_MAX_SPREAD,
  MM_SOFT_INVENTORY_LIMIT,
  MM_TICK_MS,
} from '@/data/marketMakerScenarios'
import { formatMoney, formatPrice, formatSigned, pnlColor, plural } from '@/lib/formatting'
import type { MarketMakerResult, MarketMakerScenario, MMTrade } from '@/types/game'
import { AccountingDebug } from './AccountingDebug'
import { MarketMakerEngine, type MarketMakerSnapshot } from './engine'
import './MarketMakerGame.css'

type Stage = 'intro' | 'running' | 'finished'

const RECENT_TRADES = 4

export function MarketMakerGame({
  context,
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
    return <ChallengeIntro className="mm-intro" number="02" title={<>Маркет-<br />мейкер</>}
      subtitle="Каждая котировка — новое решение."
      description={`Выставляйте цены покупки и продажи. Зарабатывайте на исполнении заявок, управляйте спредом и следите за накопленной позицией. У вас ${scenario.durationSeconds} секунд.`}
      howItWorks={[
        'Задайте цены покупки (Bid) и продажи (Ask).',
        'Рыночные заявки исполняются по вашим котировкам.',
        'Исполнение котировок может приносить доход от спреда. Накопленная позиция создаёт рыночный риск.',
      ]}
      stats={[
        { value: `${scenario.durationSeconds} с`, label: 'раунд' },
        { value: 'Bid / Ask', label: 'две стороны котировки' },
        { value: `${scenario.softInventoryLimit ?? MM_SOFT_INVENTORY_LIMIT} лотов`, label: 'Порог повышенного риска' },
      ]}
      note={scenario.mode === 'advanced' ? 'Хедж дороже, а позиция сверх лимита несёт дополнительные издержки удержания.' : 'Исполнение котировок может приносить доход от спреда. Накопленная позиция создаёт рыночный риск, а хеджирование требует затрат.'}
      cta="Начать раунд" visual={<ChallengeIllustration kind="market-maker" />}
      mode={context?.mode ?? scenario.mode ?? 'standard'} state={stage}
      onStart={() => { trackEvent('scenario_started', { challengeType: 'market-maker', scenarioId: scenario.id, mode: scenario.mode }); setStage('running') }} />
  }

  if (!snapshot) return null

  return (
    <div className="mm-terminal mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-8 sm:py-8">
      <header className="mm-terminal-header">
        <span className="mm-terminal-status"><span aria-hidden />Вы котируете рынок</span>
        <RoundTimer secondsLeft={snapshot.secondsLeft} progress={snapshot.tick / snapshot.totalTicks} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div
            className={`mm-quotes grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 ${
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

          <div className="mm-chart rounded-xl border border-ink-700 bg-ink-900 p-3 sm:p-5">
            <QuoteChart
              points={snapshot.history}
              trades={snapshot.trades}
              totalTicks={snapshot.totalTicks}
              emphasizeQuotes
            />
            <QuoteLegend compact />
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

        <aside className="mm-sidebar flex min-w-0 flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <InventoryCard softLimit={scenario.softInventoryLimit} inventory={snapshot.inventory} />
            <PnlCard value={snapshot.pnl} />
          </div>

          <RecentTrades trades={snapshot.trades} />
          {import.meta.env.DEV && import.meta.env.VITE_MM_ACCOUNTING_DEBUG === 'true' && <div className="mm-debug"><AccountingDebug data={snapshot.accounting} /></div>}

          <p className="text-[11px] leading-relaxed text-chalk-500">
            Справедливая цена скрыта. У вас есть рыночная цена, собственная котировка и
            поток сделок.
          </p>
        </aside>
      </div>
    </div>
  )
}

export function RoundTimer({ secondsLeft, progress }: { secondsLeft: number; progress: number }) {
  const urgency = secondsLeft <= 5 ? 'critical' : secondsLeft <= 10 ? 'warning' : 'normal'
  return (
    <div className="mm-timer" data-urgency={urgency}>
      <div className="mm-timer-heading">
        <span className="mm-label">До конца раунда</span>
        <span className="mm-timer-value tnum" role="timer" aria-label={`Осталось ${secondsLeft} ${plural(secondsLeft, ['секунда', 'секунды', 'секунд'])}`}>
          {secondsLeft}<span>с</span>
        </span>
      </div>
      <div className="mm-timer-track" aria-hidden="true">
        <div className="mm-timer-progress" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>
    </div>
  )
}

export function PnlCard({ value }: { value: number }) {
  // Sign and color follow the displayed, rounded amount (including negative zero).
  const rounded = Math.round(value)
  const formatted = formatMoney(rounded, rounded !== 0)
  return (
    <div className="mm-pnl flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-4">
      <span className="text-[11px] tracking-[0.16em] text-chalk-500 uppercase">PnL</span>
      <span className={`mm-pnl-value tnum ${pnlColor(rounded)}`} data-compact={formatted.length > 9}>
        {formatted}
      </span>
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
    <div className={`mm-quote-cell flex flex-col justify-between gap-2 bg-ink-900 px-4 py-5 sm:px-6 ${alignment}`}>
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
  if (size > MM_HARD_INVENTORY_LIMIT) return { label: 'высокий', className: 'text-market-down' }
  if (size > softLimit) return { label: 'высокий', className: 'text-risk' }
  if (size >= Math.ceil(softLimit / 2)) return { label: 'средний', className: 'text-risk' }
  return { label: 'низкий', className: 'text-chalk-400' }
}

export function InventoryCard({ inventory, softLimit = MM_SOFT_INVENTORY_LIMIT }: { inventory: number; softLimit?: number }) {
  const risk = riskLevel(inventory, softLimit)
  const scale = MM_HARD_INVENTORY_LIMIT + 5
  const position = ((Math.max(-scale, Math.min(scale, inventory)) + scale) / (scale * 2)) * 100
  const softOffset = (softLimit / (scale * 2)) * 100
  const hardOffset = (MM_HARD_INVENTORY_LIMIT / (scale * 2)) * 100
  const aboveSoft = Math.abs(inventory) > softLimit
  const aboveHard = Math.abs(inventory) > MM_HARD_INVENTORY_LIMIT

  return (
    <div
      className={`mm-inventory-card flex flex-col gap-3 rounded-xl border bg-ink-900 px-4 py-4 transition-colors duration-300 ${
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
        {formatSigned(inventory)} <span className="text-sm text-chalk-500">{plural(inventory, ['лот', 'лота', 'лотов'])}</span>
      </span>

      <div className="mm-inventory-scale" role="img" aria-label={`Позиция ${formatSigned(inventory)}. Пороги повышенного риска: ${formatSigned(-softLimit)} и ${formatSigned(softLimit)} лотов. Диапазон шкалы: от −${scale} до +${scale}.`}>
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

        <div className="mm-inventory-labels tnum" aria-hidden="true">
          {[-softLimit, 0, softLimit].map(value => (
            <span key={value} style={{ left: `${50 + value / (scale * 2) * 100}%` }}>{formatSigned(value)}</span>
          ))}
        </div>
      </div>

      <p
        className={`mm-inventory-hint text-[11px] leading-snug ${
          aboveSoft ? '' : 'text-chalk-500'
        } ${aboveHard ? 'text-market-down' : aboveSoft ? 'text-risk/90' : ''}`}
        aria-live="polite"
      >
        {aboveHard
          ? 'Позиция сверх лимита: высокий позиционный риск'
          : aboveSoft ? 'Позиционный риск растёт' : 'Отмечены пороги повышенного риска'}
      </p>
    </div>
  )
}

export function RecentTrades({ trades }: { trades: MMTrade[] }) {
  const recentTrades = trades.slice(-RECENT_TRADES).reverse()
  return (
    <div className="mm-trades rounded-xl border border-ink-700 bg-ink-900 p-4" style={{ '--mm-trade-rows': RECENT_TRADES } as CSSProperties}>
      <SectionLabel>Последние сделки</SectionLabel>
      <div className="mm-trade-columns mm-trade-head" aria-hidden="true">
        <span>Клиент</span><span>Лоты</span><span>Цена</span>
      </div>
      {trades.length === 0 ? (
        <p className="mm-trade-list py-4 text-xs text-chalk-500">Пока нет исполненных заявок</p>
      ) : (
        <ul className="mm-trade-list" aria-label="Последние сделки, новые сверху">
          {recentTrades.map((trade) => (
            <li
              key={`${trade.tick}-${trade.botSide}`}
              className={`mm-trade-columns mm-trade-row tnum ${trade.increasedRisk ? 'mm-trade-risk' : ''}`}
              title={`Клиент ${trade.botSide === 'buy' ? 'купил' : 'продал'} ${trade.size} ${plural(trade.size, ['лот', 'лота', 'лотов'])} по вашей ${trade.botSide === 'buy' ? 'Ask' : 'Bid'}. Ваш инвентарь ${trade.botSide === 'buy' ? 'уменьшился' : 'увеличился'} на ${trade.size} ${plural(trade.size, ['лот', 'лота', 'лотов'])}.${trade.increasedRisk ? ' Абсолютная позиция выросла.' : ''}`}
              tabIndex={0}
            >
              <span>{trade.botSide === 'buy' ? 'Купили' : 'Продали'}</span>
              <span><span className="sr-only">Лотов: </span>{trade.size}</span>
              <span className={trade.botSide === 'buy' ? 'text-market-down' : 'text-market-up'}>
                <span className="sr-only">Цена: </span>{formatPrice(trade.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mm-trade-note"><span aria-hidden />Выделены сделки, увеличившие модуль позиции.</p>
    </div>
  )
}

export function Controls({
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
    <div className="mm-controls">
      <ControlGroup label="Смещение котировок">
        <ControlButton onClick={onLower} shortcut="←" shortcutCode="ArrowLeft">Ниже</ControlButton>
        <ControlButton onClick={onHigher} shortcut="→" shortcutCode="ArrowRight">Выше</ControlButton>
      </ControlGroup>
      <ControlGroup label="Управление спредом" detail={formatPrice(spread)}>
        <ControlButton onClick={onNarrow} disabled={spread <= MM_MIN_SPREAD} shortcut="↓" shortcutCode="ArrowDown">Сузить</ControlButton>
        <ControlButton onClick={onWiden} disabled={spread >= MM_MAX_SPREAD} shortcut="↑" shortcutCode="ArrowUp">Расширить</ControlButton>
      </ControlGroup>
      <ControlGroup label="Управление риском" detail={`Стоимость хеджа: ${hedgeDisabled ? '—' : `${formatMoney(hedgeCost, false)} ед.`}`}>
        <ControlButton onClick={onHedge} disabled={hedgeDisabled} accent wide shortcut="H" shortcutCode="H">
          Хеджировать
        </ControlButton>
      </ControlGroup>
    </div>
  )
}

function ControlGroup({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <div className="mm-control-group" role="group" aria-label={label}>
      <div className="mm-control-heading">
        <span className="mm-label">{label}</span>
        <span className="mm-control-detail tnum">{detail || '\u00a0'}</span>
      </div>
      <div className="mm-control-buttons">{children}</div>
    </div>
  )
}

function ControlButton({
  children, onClick, disabled, accent, wide, shortcut, shortcutCode,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: boolean
  wide?: boolean
  shortcut: string
  shortcutCode: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcutCode}
      className={`mm-control-button ${wide ? 'mm-control-wide' : ''} ${accent ? 'mm-control-accent' : ''}`}
    >
      <span>{children}</span><kbd aria-hidden="true">{shortcut}</kbd>
    </button>
  )
}
