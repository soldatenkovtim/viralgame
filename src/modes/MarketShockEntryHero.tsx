import './MarketShockEntry.css'

/** Fixed explanatory geometry, with no scenario, price feed or engine inputs. */
export function MarketShockEntryHero() {
  return <header className="mm-entry-hero">
    <div className="mm-entry-copy">
      <p className="micro-label mm-entry-eyebrow">ИСПЫТАНИЕ 03 / РЫНОЧНЫЙ ШОК</p>
      <h1>РЫНОЧНЫЙ<br />ШОК<span>.</span></h1>
      <p className="mm-entry-description">Рынок изменился. Позиция осталась.<br />Вы уже в позиции, когда рыночные условия резко меняются. Оцените происходящее и принимайте решения, контролируя риск.</p>
      <ul className="mm-entry-facts" aria-label="Механика испытания">
        <li>Открытая позиция</li><li>Рыночное событие</li><li>Управление риском</li>
      </ul>
    </div>
    <figure className="shock-entry-chart" aria-label="Условный пример резкого изменения цены и диапазона колебаний">
      <figcaption><span>СМЕНА РЫНОЧНЫХ УСЛОВИЙ</span><span>ДЕМОНСТРАЦИЯ</span></figcaption>
      <svg viewBox="0 0 560 320" role="img" aria-label="Спокойные колебания сменяются скачком и более широким диапазоном движения цены. Направление условное.">
        <g className="shock-entry-grid">
          {[60,110,160,210,260].map(y=><path key={y} d={`M16 ${y}H544`} />)}
          {[60,140,220,300,380,460,540].map(x=><path key={x} d={`M${x} 32V280`} />)}
        </g>
        <path className="shock-entry-baseline" d="M16 195H544" />
        <rect x="278" y="32" width="18" height="248" fill="currentColor" opacity=".06" />
        <path className="shock-entry-event" d="M287 32V280" />
        <text x="300" y="25" className="shock-entry-label">СОБЫТИЕ</text>
        <path className="shock-entry-price" d="M16 198L30 194L44 200L58 190L72 196L86 191L100 199L114 194L128 190L142 197L156 192L170 200L184 193L198 195L212 188L226 196L240 190L254 194L268 187L280 190L292 103L306 70L320 106L334 86L348 128L362 102L376 136L390 113L404 142L418 118L432 130L446 106L460 128L474 116L488 139L502 119L516 126L530 111L544 120" />
        <g className="shock-entry-label"><text x="16" y="305">ДО СОБЫТИЯ</text><text x="330" y="305">ПОСЛЕ СОБЫТИЯ</text></g>
      </svg>
      <div className="shock-entry-volatility"><span>Диапазон колебаний</span><span><i aria-hidden="true" />Узкий → широкий</span></div>
      <p>Схема механики · не игровой сценарий</p>
      <p>Направление движения условное и не предсказывает событие испытания.</p>
    </figure>
  </header>
}
