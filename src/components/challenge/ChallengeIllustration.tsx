import { useEffect, useId, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { ChallengeType } from '@/types/game'

const descriptions: Record<ChallengeType, string> = {
  'blind-market': 'История цены заканчивается у границы неизвестности. За ней — несколько возможных траекторий.',
  'market-maker': 'Ask — цена продажи, Bid — цена покупки. Расстояние между котировками — спред. Отдельный индикатор показывает инвентарь — накопленную позицию.',
  'black-swan': 'После рыночного события цена резко движется. Дальнейшее развитие остаётся неопределённым.',
  'cross-arbitrage': 'Цены двух площадок расходятся и сближаются. Возможность сделки зависит от условий исполнения.',
}

/** All coordinates are illustrative, never derived from a game scenario. */
export function ChallengeIllustration({ kind }: { kind: ChallengeType }) {
  const id = useId().replace(/:/g, '')
  const figure = useRef<HTMLElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const element = figure.current
    if (!element) return
    let visible = false
    const sync = () => { element.dataset.running = String(visible && !document.hidden) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])

  return <figure ref={figure} className="challenge-illustration" data-kind={kind} data-paused={paused} data-running="false">
    <svg viewBox="0 0 640 500" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{kind === 'blind-market' ? 'Рынок с неизвестным продолжением' : kind === 'market-maker' ? 'Поток котировок' : kind === 'black-swan' ? 'Изменение рыночных условий' : 'Расхождение цен площадок'}</title>
      <desc id={`${id}-desc`}>{descriptions[kind]} Это условная иллюстрация.</desc>
      <defs>
        <pattern id={`${id}-grid`} width="52" height="52" patternUnits="userSpaceOnUse">
          <path d="M 52 0 H 0 V 52" fill="none" className="intro-grid-line" />
        </pattern>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-veil`}>
          <stop stopColor="var(--color-graphite)" stopOpacity=".3" />
          <stop offset="1" stopColor="var(--color-graphite)" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <rect x="24" y="68" width="592" height="364" fill={`url(#${id}-grid)`} />
      <path d="M24 68V432H616" className="intro-axis" />
      {[120, 224, 328].map(y => <path key={y} d={`M20 ${y}h8 M612 ${y}h8`} className="intro-axis" />)}
      {kind === 'blind-market' && <BlindMarket id={id} />}
      {kind === 'market-maker' && <MarketMaker />}
      {kind === 'black-swan' && <MarketShock id={id} />}
      {kind === 'cross-arbitrage' && <CrossArbitrage />}
    </svg>
    {kind === 'market-maker' && <div className="mm-intro-inventory" aria-label="Условная накопленная позиция">
      <span>INVENTORY / ПОЗИЦИЯ</span>
      <div aria-hidden="true"><i /><b /></div>
    </div>}
    <figcaption>
      <span>Схема механики · не игровой сценарий</span>
      <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Продолжить анимацию' : 'Приостановить анимацию'} aria-pressed={paused} className="intro-motion-toggle">
        {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
      </button>
    </figcaption>
  </figure>
}

const history = 'M24 310L43 308L57 322L73 290L89 298L106 268L121 280L139 273L155 294L172 250L186 258L203 221L221 235L236 216L253 239L269 208L282 218L301 177L316 189L331 166L349 188L366 174L384 182'

function BlindMarket({ id }: { id: string }) {
  return <>
    <text x="24" y="36" className="intro-svg-label">ДОСТУПНАЯ ИСТОРИЯ</text>
    <text x="604" y="36" textAnchor="end" className="intro-svg-label intro-muted">АКТИВ И ДАТА СКРЫТЫ</text>
    <path d={`${history}V432H24Z`} fill={`url(#${id}-area)`} className="intro-area intro-arrival" />
    <g className="intro-volume">{[18, 27, 16, 34, 22, 38, 28, 19, 44, 30, 52, 35, 23, 39, 28, 49, 32, 57, 41, 29, 38].map((height, i) => <rect key={i} x={28 + i * 17} y={428 - height} width="7" height={height} />)}</g>
    <rect x="384" y="68" width="232" height="364" fill={`url(#${id}-veil)`} />
    <g className="intro-possibilities">
      <path d="M384 182L410 170L434 192L458 154L482 163L509 125L536 139L566 106L604 118" />
      <path d="M384 182L410 194L434 180L458 204L482 194L509 212L536 187L566 202L604 182" />
      <path d="M384 182L410 204L434 198L458 236L482 224L509 267L536 251L566 282L604 272" />
    </g>
    <path d={history} className="intro-price intro-draw" pathLength="1" />
    <g className="intro-events intro-arrival"><circle cx="106" cy="268" r="4" /><circle cx="203" cy="221" r="4" /><circle cx="301" cy="177" r="4" /></g>
    <path d="M384 62V438" className="intro-boundary" />
    <circle cx="384" cy="182" r="17" className="intro-focus intro-arrival" />
    <circle cx="384" cy="182" r="5" className="intro-point intro-arrival" />
    <path d="M384 182h28" className="intro-boundary intro-arrival" />
    <text x="24" y="465" className="intro-svg-label intro-muted">ИСТОРИЯ</text>
    <text x="378" y="465" textAnchor="end" className="intro-svg-label">ВАШЕ РЕШЕНИЕ</text>
    <text x="604" y="465" textAnchor="end" className="intro-svg-label intro-muted">НЕИЗВЕСТНОСТЬ</text>
  </>
}

function MarketMaker() {
  return <>
    <text x="24" y="36" className="intro-svg-label">ДВУСТОРОННЯЯ КОТИРОВКА</text>
    <path d="M24 268H90V248H158V263H224V225H290V239H356V211H422V227H488V198H556V213H616" className="intro-reference" />
    <g className="intro-ask">
      <text x="604" y="142" textAnchor="end" className="intro-svg-label mm-intro-diagram-label">ASK / ПРОДАЖА</text>
      <path d="M24 228H90V208H158V223H224V185H290V199H356V171H422V187H488V158H556V173H616" className="intro-price intro-draw" pathLength="1" />
      <circle cx="257" cy="185" r="5" className="intro-point intro-fill-one" />
      <circle cx="510" cy="158" r="5" className="intro-point intro-fill-two" />
    </g>
    <g className="intro-bid">
      <text x="604" y="292" textAnchor="end" className="intro-svg-label intro-price-secondary mm-intro-diagram-label">BID / ПОКУПКА</text>
      <path d="M24 308H90V288H158V303H224V265H290V279H356V251H422V267H488V238H556V253H616" className="intro-price intro-price-secondary intro-draw" pathLength="1" />
      <circle cx="190" cy="303" r="5" className="intro-point intro-fill-one" />
      <circle cx="450" cy="267" r="5" className="intro-point intro-fill-two" />
    </g>
    <path d="M389 174V248M382 174h14M382 248h14" className="intro-boundary intro-arrival" />
    <text x="405" y="215" className="intro-svg-label mm-intro-diagram-label">SPREAD / СПРЕД</text>
    <g className="intro-liquidity">{[24, 46, 34, 64, 42, 82, 58, 32, 72, 46, 62, 30].map((h, i) => <path key={i} d={`M${46 + i * 48} 414v-${h}`} />)}</g>

  </>
}

function MarketShock({ id }: { id: string }) {
  const path = 'M24 194L45 188L63 199L84 184L108 190L130 176L152 184L174 170L198 178L221 165L244 176L267 158L286 171L302 166L320 224L335 207L354 302L372 271L390 322L411 278L430 296'
  return <>
    <text x="24" y="36" className="intro-svg-label">ПОЗИЦИЯ УЖЕ ОТКРЫТА</text>
    <path d="M24 206H302" className="intro-reference" />
    <path d={`${path}V432H24Z`} fill={`url(#${id}-area)`} className="intro-area intro-arrival" />
    <path d={path} className="intro-price intro-draw" pathLength="1" />
    <path d="M302 68V432" className="intro-boundary" />
    <text x="315" y="94" className="intro-svg-label">СОБЫТИЕ</text>
    <circle cx="302" cy="166" r="17" className="intro-focus intro-arrival" />
    <circle cx="302" cy="166" r="5" className="intro-point intro-arrival" />
    <g className="intro-possibilities">
      <path d="M430 296L452 265L475 280L499 226L522 245L547 202L573 214L608 183" />
      <path d="M430 296L452 303L475 286L499 309L522 289L547 306L573 281L608 297" />
      <path d="M430 296L452 326L475 313L499 349L522 332L547 371L573 354L608 383" />
    </g>
    <text x="24" y="465" className="intro-svg-label intro-muted">ДО СОБЫТИЯ</text>
    <text x="604" y="465" textAnchor="end" className="intro-svg-label">ПЕРЕОЦЕНКА РИСКА</text>
  </>
}

function CrossArbitrage() {
  return <>
    <text x="24" y="36" className="intro-svg-label">ЦЕНЫ ДВУХ ПЛОЩАДОК</text>
    <path d="M24 281L62 267L100 279L138 248L176 260L214 235L252 245L290 227L328 238L366 219L404 231L442 209L480 221L518 198L556 210L608 191" className="intro-reference" />
    <g className="intro-divergence">
      <path d="M24 275L62 260L100 271L138 239L176 245L214 206L252 191L290 161L328 164L366 153L404 172L442 177L480 200L518 187L556 202L608 184L608 199L556 218L518 208L480 239L442 242L404 268L366 284L328 309L290 291L252 298L214 264L176 274L138 257L100 287L62 275L24 289Z" className="intro-opportunity-area" />
      <path d="M24 275L62 260L100 271L138 239L176 245L214 206L252 191L290 161L328 164L366 153L404 172L442 177L480 200L518 187L556 202L608 184" className="intro-price" />
      <path d="M24 289L62 275L100 287L138 257L176 274L214 264L252 298L290 291L328 309L366 284L404 268L442 242L480 239L518 208L556 218L608 199" className="intro-price intro-price-secondary" />
    <path d="M328 170V301M321 170h14M321 301h14" className="intro-boundary intro-arrival" />
    <circle cx="328" cy="164" r="5" className="intro-point intro-arrival" />
    <circle cx="328" cy="309" r="5" className="intro-point intro-arrival" />
    </g>
    <text x="328" y="116" textAnchor="middle" className="intro-svg-label">РАСХОЖДЕНИЕ</text>
    <text x="24" y="465" className="intro-svg-label">ПЛОЩАДКА A</text>
    <text x="604" y="465" textAnchor="end" className="intro-svg-label intro-muted">ПЛОЩАДКА B</text>
  </>
}
