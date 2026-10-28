import { useEffect, useRef, type ReactNode } from 'react'
import type { BlindInfoKey, BlindMarketScenario } from '@/types/game'
import { infoLabels } from './InfoSelector'

/** Keep the desktop submit area in its own row, outside the scrolling fields. */
export function TerminalSidebar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const top = Math.max(16, node.getBoundingClientRect().top)
        node.style.setProperty('--terminal-panel-height', `${Math.max(400, window.innerHeight - top - 16)}px`)
      })
    }
    const observer = new ResizeObserver(measure)
    node.closest('.blind-terminal')?.querySelectorAll('header, .blind-terminal-information').forEach(element => observer.observe(element))
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [])
  return <aside ref={ref} className="blind-terminal-sidebar">{children}</aside>
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
