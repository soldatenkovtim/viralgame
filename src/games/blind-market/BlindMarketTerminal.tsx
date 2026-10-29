import type { ReactNode } from 'react'
import type { BlindInfoKey, BlindMarketScenario } from '@/types/game'
import { infoLabels } from './InfoSelector'

/** Natural height keeps the page as the only vertical scroll container. */
export function TerminalSidebar({ children }: { children: ReactNode }) {
  return <aside className="blind-terminal-sidebar">{children}</aside>
}

/** The sticky containing block starts after every field, so the CTA cannot cover them. */
export function TerminalSubmit({ children }: { children: ReactNode }) {
  return <div className="blind-terminal-submit-slot">
    <div className="blind-terminal-submit">{children}</div>
  </div>
}

/** Retain content so both expansion and collapse can animate its natural height. */
export function TerminalDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className="blind-terminal-disclosure" data-open={open} aria-hidden={!open} inert={!open}>
    <div className="blind-terminal-disclosure-inner">{children}</div>
  </div>
}

/** Reformat only the already disclosed strings; no new data or calculations. */
export function RevealedInformation({ scenario, selected }: {
  scenario: BlindMarketScenario
  selected: BlindInfoKey[]
}) {
  if (!selected.length) return null
  return <div className="blind-terminal-information" aria-label="Раскрытые источники">
    {selected.map(key => {
      const sentences = scenario.info[key].split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/u)
      const visible = sentences.slice(0, 2)
      const details = sentences.slice(2)
      return <section key={key} className="blind-terminal-source" aria-label={infoLabels[key]}>
        <h2>{infoLabels[key]}</h2>
        {visible.map((text, i) => <p key={i}>{text}</p>)}
        {details.length > 0 && <details>
          <summary>Подробности</summary>
          {details.map((text, i) => <p key={i}>{text}</p>)}
        </details>}
      </section>
    })}
  </div>
}

export function DecisionChoice({ label, hint, selected, disabled = false, onClick }: {
  label: string
  hint?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return <button type="button" className="blind-terminal-choice" aria-pressed={selected} disabled={disabled} onClick={onClick}>
    <span>{label}</span>
    {hint && <small>{hint}</small>}
  </button>
}

export function DecisionHint({ lastDecision }: { lastDecision: boolean }) {
  return <p className="blind-terminal-decision-hint">
    {lastDecision
      ? 'После подтверждения вы увидите завершение рынка и результаты.'
      : 'После подтверждения рынок перейдёт к следующему этапу.'}
  </p>
}
