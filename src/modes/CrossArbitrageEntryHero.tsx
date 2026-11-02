import './CrossArbitrageEntry.css'

// Illustrative coordinates only. The same points bound the fill and the two quote lines.
const venueA = '16,116 37,116 48,108 68,108 77,111 94,111 108,103 126,103 138,106 154,106 170,96 188,96 205,80 225,80 238,86 250,86 270,64 290,64 306,48 327,48 339,54 361,54 377,43 395,43 414,60 427,60 444,76 459,76 477,86 497,86 510,80 524,80'
const venueB = '16,121 32,121 49,113 69,113 83,119 99,119 112,109 131,109 146,115 161,115 179,110 198,110 211,116 231,116 247,126 268,126 280,120 300,120 316,133 337,133 354,125 373,125 386,130 404,130 421,116 440,116 455,105 472,105 488,94 505,94 518,89 524,89'

export function CrossArbitrageEntryHero() {
  return <header className="mm-entry-hero">
    <div className="mm-entry-copy">
      <p className="micro-label mm-entry-eyebrow">ИСПЫТАНИЕ 04 / КРОСС-АРБИТРАЖ</p>
      <h1>КРОСС-<br />АРБИТРАЖ<span>.</span></h1>
      <p className="arb-entry-lead">Один актив. Две площадки. Разные цены.</p>
      <p className="mm-entry-description">Сравните котировки и выберите, где купить актив и где его продать. Учитывайте комиссии и доступный объём. Если сделка невыгодна, её можно пропустить.</p>
      <ul className="mm-entry-facts" aria-label="Механика испытания">
        <li>Маршрут сделки</li><li>Комиссии</li><li>Ликвидность</li>
      </ul>
    </div>
    <figure className="mm-quotes arb-entry-chart">
      <figcaption><span>РАСХОЖДЕНИЕ КОТИРОВОК</span><span className="mm-demo-label">ДЕМОНСТРАЦИЯ</span></figcaption>
      <svg viewBox="0 0 540 204" role="img" aria-label="Котировки площадок A и B расходятся, затем сближаются. Вертикальный отрезок показывает разницу цен в один момент времени.">
        <g className="arb-chart-grid">
          {[36, 70, 104, 138, 172].map(y => <path key={y} d={`M16 ${y}H524`} />)}
          {[16, 80, 144, 208, 272, 336, 400, 464, 524].map(x => <path key={x} d={`M${x} 18V172`} />)}
        </g>
        <polygon fill="var(--accent)" opacity=".09" points={`${venueA} ${venueB.split(' ').reverse().join(' ')}`} />
        <g fill="none" strokeWidth="2" strokeLinejoin="round">
          <polyline points={venueB} stroke="var(--secondary)" />
          <polyline points={venueA} stroke="var(--accent)" />
        </g>
        <g stroke="var(--accent)" fill="none">
          <path d="M320 18V172" strokeDasharray="2 5" opacity=".45" />
          <path d="M320 48V133 M315 48H325 M315 133H325" strokeWidth="1.5" />
        </g>
        <text x="332" y="95" fill="var(--accent)">Δ PRICE</text>
        <path d="M16 172H524" stroke="var(--border)" />
        <text x="524" y="196" textAnchor="end" fill="var(--muted)">ВРЕМЯ →</text>
      </svg>
      <div className="arb-chart-legend" aria-hidden="true"><span>ПЛОЩАДКА A</span><span>ПЛОЩАДКА B</span></div>
      <p className="mm-quotes-note">Схема механики · не игровой сценарий</p>
    </figure>
  </header>
}
