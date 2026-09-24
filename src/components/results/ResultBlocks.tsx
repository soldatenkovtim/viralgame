import { Sparkles, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProfileMeter } from '@/components/progress/ProgressDots'
import { SectionLabel } from '@/components/ui/Card'
import { formatNumber } from '@/lib/formatting'
import type { Achievement } from '@/types/game'

export function ResultHeader({
  eyebrow,
  headline,
  children,
}: {
  eyebrow: string
  headline: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5">
      <SectionLabel>{eyebrow}</SectionLabel>
      <h1 className="text-4xl font-light tracking-[-0.025em] text-chalk-50 sm:text-5xl">
        {headline}
      </h1>
      {children}
    </header>
  )
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-7 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

export interface TimelineStep {
  marker: string
  title: string
  detail?: string
  tone?: 'up' | 'down' | 'neutral'
}

/** Таймлайн решений — главный способ пересказать сессию игроку. */
export function DecisionTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const dotColor =
          step.tone === 'up'
            ? 'bg-market-up'
            : step.tone === 'down'
              ? 'bg-market-down'
              : 'bg-violet-accent'

        return (
          <li key={`${step.marker}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
              {!isLast ? <span className="w-px flex-1 bg-ink-700" aria-hidden /> : null}
            </div>

            <div className={`flex flex-col gap-1 ${isLast ? 'pb-0' : 'pb-7'}`}>
              <span className="text-[11px] tracking-[0.14em] text-chalk-500 uppercase">
                {step.marker}
              </span>
              <span className="text-base text-chalk-50">{step.title}</span>
              {step.detail ? (
                <span className="tnum text-sm text-chalk-400">{step.detail}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function CrowdStats({
  title,
  items,
  note = 'В прототипе используются тестовые данные сравнения.',
}: {
  title: string
  items: { label: string; percent: number }[]
  note?: string
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-normal tracking-tight text-chalk-50">
          Как действовали другие
        </h3>
        <span className="text-sm text-chalk-400">{title}</span>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-chalk-200">{item.label}</span>
              <span className="tnum text-chalk-400">{item.percent}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-violet-accent/70"
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-chalk-500">{note}</p>
    </div>
  )
}

export function AchievementNote({ achievement }: { achievement: Achievement | null }) {
  if (!achievement) return null

  return (
    <div className="flex animate-fade-up items-start gap-4 rounded-xl border border-violet-accent/35 bg-violet-dim/25 p-5">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-soft" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="text-base text-chalk-50">{achievement.title}</span>
        <span className="text-sm leading-relaxed text-chalk-400">
          {achievement.description}
        </span>
      </div>
    </div>
  )
}

export function PersonalBestNote({
  isPersonalBest,
  pointsToBest,
  points,
  hasPrevious,
}: {
  isPersonalBest: boolean
  pointsToBest: number
  points: number
  hasPrevious: boolean
}) {
  if (!hasPrevious) {
    return (
      <div className="flex items-center gap-3 text-sm text-chalk-400">
        <TrendingUp className="h-4 w-4 text-chalk-500" aria-hidden />
        <span className="tnum">Результат испытания: {formatNumber(points)} очков</span>
      </div>
    )
  }

  if (isPersonalBest) {
    return (
      <div className="flex items-center gap-3 text-sm text-violet-soft">
        <TrendingUp className="h-4 w-4" aria-hidden />
        <span className="tnum">Новый личный результат: {formatNumber(points)} очков</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm text-chalk-400">
      <TrendingUp className="h-4 w-4 text-chalk-500" aria-hidden />
      <span className="tnum">
        До лучшего результата: {formatNumber(pointsToBest)} очков
      </span>
    </div>
  )
}

export function ProfileProgressBlock() {
  return (
    <div className="w-full max-w-sm">
      <ProfileMeter />
    </div>
  )
}
