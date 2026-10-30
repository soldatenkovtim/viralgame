/** An illustrative quote snapshot only; deliberately independent of the game engine. */
export function MarketMakerEntryHero() {
  return <header className="mm-entry-hero">
    <div className="mm-entry-copy">
      <p className="micro-label mm-entry-eyebrow">ИСПЫТАНИЕ 02 / МАРКЕТ-МЕЙКЕР</p>
      <h1>МАРКЕТ-<br />МЕЙКЕР<span>.</span></h1>
      <p className="mm-entry-description">Выставляйте котировки, управляйте спредом и контролируйте позицию. У вас 60 секунд, чтобы заработать на потоке рыночных заявок.</p>
      <ul className="mm-entry-facts" aria-label="Механика испытания">
        <li>60 секунд</li><li>Bid / Ask</li><li>Спред и инвентарь</li>
      </ul>
    </div>
    <figure className="mm-quotes" aria-label="Демонстрационный пример котировок и позиции">
      <figcaption><span>ДВЕ СТОРОНЫ РЫНКА</span><span className="mm-demo-label">ДЕМОНСТРАЦИЯ</span></figcaption>
      <div className="mm-quote-pair">
        <div><p>BID <span>Покупка</span></p><strong>99.95</strong></div>
        <div><p>ASK <span>Продажа</span></p><strong>100.05</strong></div>
      </div>
      <div className="mm-spread"><span aria-hidden="true" /><p>SPREAD <strong>0.10</strong></p><span aria-hidden="true" /></div>
      <div className="mm-book" aria-label="Пример стакана заявок">
        <div className="mm-book-head"><span>Объём</span><span>Bid</span><span>Ask</span><span>Объём</span></div>
        {[
          { bid: '99.95', ask: '100.05', buy: 24, sell: 18 },
          { bid: '99.90', ask: '100.10', buy: 38, sell: 32 },
          { bid: '99.85', ask: '100.15', buy: 56, sell: 48 },
        ].map(row => <div className="mm-book-row" key={row.bid}>
          <span className="mm-depth mm-depth-bid"><i aria-hidden="true" style={{ width: `${row.buy / 60 * 100}%` }} />{row.buy}</span>
          <span>{row.bid}</span><span>{row.ask}</span>
          <span className="mm-depth"><i aria-hidden="true" style={{ width: `${row.sell / 60 * 100}%` }} />{row.sell}</span>
        </div>)}
      </div>
      <div className="mm-inventory">
        <p><span>INVENTORY / ПОЗИЦИЯ</span><strong>+12 лотов</strong></p>
        <div className="mm-inventory-track" aria-hidden="true"><span /><i /></div>
        <div className="mm-inventory-labels" aria-hidden="true"><span>−30</span><span>0</span><span>+30</span></div>
      </div>
      <p className="mm-quotes-note">Условные котировки · не игровые данные</p>
    </figure>
  </header>
}
