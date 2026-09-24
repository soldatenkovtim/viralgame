import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  muted = false,
}: {
  children: ReactNode
  className?: string
  muted?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-ink-700 ${muted ? 'bg-ink-950' : 'bg-ink-900'} ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-chalk-500">
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  valueClassName = '',
  hint,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-chalk-500">{label}</div>
      <div className={`tnum text-2xl leading-none font-light ${valueClassName}`}>{value}</div>
      {hint ? <div className="text-xs text-chalk-500">{hint}</div> : null}
    </div>
  )
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-chalk-500">{children}</p>
}
