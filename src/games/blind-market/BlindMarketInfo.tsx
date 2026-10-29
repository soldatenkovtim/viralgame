import { useId } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { BlindInfoKey, BlindMarketScenario } from '@/types/game'
import { InfoSelector, MAX_INFO_SLOTS } from './InfoSelector'
import './BlindMarketInfo.css'

/** The existing game owns selection and disclosure; this screen only presents them. */
export function BlindMarketInfo({ scenario, selected, onSelect, onStart }: {
  scenario: BlindMarketScenario
  selected: BlindInfoKey[]
  onSelect: (key: BlindInfoKey) => void
  onStart: () => void
}) {
  const heading = useId()
  const instructions = useId()
  const revealed = selected.length >= MAX_INFO_SLOTS
  return <section className="blind-info" aria-labelledby={heading}>
    <div className="site-container blind-info-content">
      <header className="blind-info-heading">
        <p className="blind-info-eyebrow">Перед началом</p>
        <h1 id={heading} className="hero-title blind-info-title">
          <span className={revealed ? 'blind-info-title-inactive' : undefined} aria-hidden={revealed}>
            Выберите два<br className="blind-info-title-break" /> источника информации.
          </span>
          <span className={!revealed ? 'blind-info-title-inactive' : undefined} aria-hidden={!revealed}>
            Информация раскрыта.
          </span>
        </h1>
        <p className="blind-info-description">
          {revealed
            ? 'Вы раскрыли два источника информации. Остальные данные останутся скрытыми до конца испытания.'
            : `Объём торгов уже доступен на графике. Вы можете раскрыть ещё ${selected.length === 0 ? 'два источника' : 'один источник'} информации.`}
        </p>
        <p id={instructions} className="blind-info-instructions">
          {revealed ? 'Теперь вы можете перейти к анализу рынка.' : 'Каждый выбор окончательный.'}
        </p>
      </header>

      <div role="group" aria-label="Источники информации" aria-describedby={instructions}>
        <InfoSelector scenario={scenario} selected={selected} onSelect={onSelect} />
      </div>

      <div className="blind-info-actions">
        <p className="blind-info-count" role="status" aria-live="polite" aria-atomic="true">
          Выбрано <span>{selected.length}</span> из {MAX_INFO_SLOTS}
        </p>
        <Button variant="primary" size="lg" className="blind-info-cta"
          disabled={selected.length < MAX_INFO_SLOTS} onClick={onStart}>
          Открыть рынок <ArrowUpRight size={20} aria-hidden="true" />
        </Button>
      </div>
    </div>
  </section>
}
