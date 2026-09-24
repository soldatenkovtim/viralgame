import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { trackEvent } from '@/lib/analytics'

const LINKS = [
  { to: '/company', label: 'Чем мы занимаемся' },
  { to: '/team', label: 'Посмотреть команду' },
  { to: '/careers', label: 'Возможности для трейдеров' },
]

/** Мягкая конверсия: блок не перекрывает результат и ничего не требует. */
export function CompanyCta({ source }: { source: string }) {
  return (
    <section className="flex flex-col gap-8 rounded-xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <h2 className="max-w-3xl text-2xl leading-snug font-light tracking-[-0.02em] text-chalk-50 sm:text-3xl">
          Мы тоже любим рынки, где правильный ответ не лежит на поверхности.
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-chalk-400">
          Мы строим системные торговые стратегии и работаем с трейдерами,
          исследователями и специалистами по алгоритмической торговле.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => trackEvent('company_cta_clicked', { target: link.to, source })}
            className="group flex min-h-14 items-center justify-between gap-3 rounded-lg border border-ink-700 px-5 text-sm text-chalk-200 transition-colors hover:border-violet-accent/50 hover:text-chalk-50"
          >
            {link.label}
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-chalk-500 transition-colors group-hover:text-violet-soft"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
