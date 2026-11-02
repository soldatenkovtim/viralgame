import { Fragment } from 'react'
import { Button } from '@/components/ui/Button'
import { formatNumber, formatPrice, pnlColor } from '@/lib/formatting'
import type { ArbitrageVenueQuote } from '@/types/game'
import { ARB_POSITION_SIZES, evaluateTrade, type TradeOutcome } from './engine'
import { formatEdge, sizeLabel } from './scoring'
import './CrossArbitrageTerminal.css'

type Market = { quotes: ArbitrageVenueQuote[]; buyVenue: string | null; sellVenue: string | null }

export function RoundClock({ remaining, total }: { remaining: number; total: number }) {
  return <div className="arb-clock" data-urgent={remaining <= 5} role="timer" aria-label={`Осталось ${remaining} секунд`}>
    <div><span>Осталось</span><strong>{remaining} с</strong></div>
    <progress max={total} value={remaining} aria-label="Оставшееся время" />
  </div>
}

function QuotePrice({ value, side }: { value: number; side?: string }) {
  return <td className="arb-price" data-selected={Boolean(side)}>
    {formatPrice(value)}
    {side && <small>{side}</small>}
  </td>
}

export function QuoteBoard({ quotes, buyVenue, sellVenue, converging }: Market & { converging: boolean }) {
  const hasDepth = quotes.some(q => q.secondBidLiquidity || q.secondAskLiquidity || q.thirdBidLiquidity || q.thirdAskLiquidity)
  return <section className="arb-panel arb-market" aria-label="Рынок">
    <header className="arb-panel-head"><h2>Рынок</h2><span>Котировки площадок</span></header>
    <table className="arb-quotes" aria-label="Котировки и доступный объём">
      <thead><tr><th scope="col">Площадка</th><th scope="col">Bid</th><th scope="col">Ask</th><th scope="col">Комиссия</th><th scope="col">Доступно<br />Bid / Ask, ед.</th></tr></thead>
      <tbody>{quotes.map(q => <tr key={q.venueId}>
        <th scope="row">{q.venueName}</th>
        <QuotePrice value={q.bid} side={sellVenue === q.venueId ? 'Продажа' : undefined} />
        <QuotePrice value={q.ask} side={buyVenue === q.venueId ? 'Покупка' : undefined} />
        <td className="arb-fee"><small>Комиссия </small>{formatNumber(q.feeRate * 100, 2)}%</td>
        <td className="arb-volume"><small>Bid / Ask, ед. </small>{q.bidLiquidity} / {q.askLiquidity}</td>
      </tr>)}</tbody>
    </table>
    <div className="arb-board-note"><span>Покупка — по Ask. Продажа — по Bid.</span>{converging && <span>Котировки обновляются</span>}</div>
    {hasDepth && <details className="arb-depth"><summary>Глубина по площадкам</summary>
      <table aria-label="Следующие уровни цены и объёма"><thead><tr><th>Площадка</th><th>Уровень</th><th>Bid · ед.</th><th>Ask · ед.</th></tr></thead>
        <tbody>{quotes.map(q => <Fragment key={q.venueId}>{[
          { level: 2, bid: q.secondBid, ask: q.secondAsk, bidUnits: q.secondBidLiquidity, askUnits: q.secondAskLiquidity },
          { level: 3, bid: q.thirdBid, ask: q.thirdAsk, bidUnits: q.thirdBidLiquidity, askUnits: q.thirdAskLiquidity },
        ].filter(level => level.bidUnits || level.askUnits).map(level => <tr key={level.level}>
          <th scope="row">{q.venueName}</th><td>{level.level}</td>
          <td>{level.bid !== undefined ? formatPrice(level.bid) : '—'} · {level.bidUnits ?? '—'}</td>
          <td>{level.ask !== undefined ? formatPrice(level.ask) : '—'} · {level.askUnits ?? '—'}</td>
        </tr>)}</Fragment>)}</tbody>
      </table>
    </details>}
  </section>
}

function VenuePicker({ label, quotes, selected, disabled, onSelect }: {
  label: string; quotes: ArbitrageVenueQuote[]; selected: string | null; disabled?: string | null; onSelect: (id: string) => void
}) {
  return <fieldset><legend>{label}</legend><div className="arb-options">
    {quotes.map(q => <button type="button" key={q.venueId} disabled={disabled === q.venueId} aria-pressed={selected === q.venueId}
      onClick={() => onSelect(q.venueId)}>{q.venueName}</button>)}
  </div></fieldset>
}

function TradeEstimate({ estimate }: { estimate: TradeOutcome }) {
  const percent = estimate.capitalReturn * 100
  return <section className="arb-estimate" aria-label="Предпросмотр сделки">
    <div className="arb-estimate-total"><div><h3>Изменение капитала раунда</h3><span>В сделке {formatNumber(estimate.positionSize * 100)}% капитала</span></div>
      <strong className={pnlColor(Number(percent.toFixed(2)))}>{formatEdge(percent)}</strong>
    </div>
    <dl className="arb-costs" aria-label="В процентах на единицу актива">
      <div><dt>Расхождение</dt><dd>{formatEdge(estimate.grossReturn * 100)}</dd></div>
      <div><dt>Комиссии</dt><dd>{formatEdge(-estimate.feeReturn * 100)}</dd></div>
      <div><dt>Проскальзывание</dt><dd>{formatEdge(-estimate.slippageReturn * 100)}</dd></div>
    </dl>
    <p>Доходность сделки <b>{formatEdge(estimate.netReturn * 100)}</b></p>
  </section>
}

export function TradeTicket({ quotes, buyVenue, sellVenue, positionSize, onBuy, onSell, onSize, onExecute, onSkip }: Market & {
  positionSize: number; onBuy: (id: string) => void; onSell: (id: string) => void; onSize: (size: number) => void
  onExecute: () => void; onSkip: () => void
}) {
  const buy = quotes.find(q => q.venueId === buyVenue)
  const sell = quotes.find(q => q.venueId === sellVenue)
  const hasRoute = buy && sell && buy !== sell
  let estimate: TradeOutcome | undefined
  if (hasRoute) {
    try {
      estimate = evaluateTrade(quotes, buy.venueId, sell.venueId, positionSize)
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Insufficient depth') throw error
    }
  }

  return <section className="arb-panel arb-ticket" aria-label="Ваша сделка">
    <header className="arb-panel-head"><h2>Ваша сделка</h2></header>
    <div className="arb-ticket-body">
      <VenuePicker label="Купить · Ask" quotes={quotes} selected={buyVenue} onSelect={onBuy} />
      <VenuePicker label="Продать · Bid" quotes={quotes} selected={sellVenue} disabled={buyVenue} onSelect={onSell} />
      <div className="arb-route">
        <h3>Маршрут</h3>
        {hasRoute ? <><strong>{buy.venueName} → {sell.venueName}</strong><p>Ask {formatPrice(buy.ask)} <span>→</span> Bid {formatPrice(sell.bid)}</p></>
          : <p>{buy ? 'Выберите площадку продажи.' : sell ? 'Выберите площадку покупки.' : 'Выберите площадки покупки и продажи.'}</p>}
      </div>
      <fieldset disabled={!hasRoute}><legend>Размер сделки</legend><div className="arb-options">
        {ARB_POSITION_SIZES.map(size => <button type="button" key={size} aria-pressed={size === positionSize} onClick={() => onSize(size)}>{sizeLabel(size)}</button>)}
      </div></fieldset>
      {estimate && buy && sell && <p className="arb-fill-note">{estimate.liquidityHit
        ? `По лучшим ценам доступно ${Math.min(buy.askLiquidity, sell.bidLiquidity)} из ${sizeLabel(positionSize)} Остаток исполнится по менее выгодной цене.`
        : 'Весь объём доступен по лучшим ценам.'}</p>}
      {estimate ? <TradeEstimate estimate={estimate} /> : <p className="arb-estimate arb-empty">{hasRoute
        ? 'Для этого объёма недостаточно ликвидности. Уменьшите размер или смените площадку.'
        : 'Ожидаемый результат появится после выбора маршрута.'}</p>}
      <div className="arb-actions"><Button variant="primary" disabled={!estimate} onClick={onExecute}>Исполнить сделку</Button><Button onClick={onSkip}>Сделки нет</Button></div>
    </div>
  </section>
}
