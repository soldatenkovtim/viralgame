import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, Check, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { challengeNumbers, challengeRoutes, challengeTitles, useGameStore } from '@/store/gameStore'
import { preferredTrialMode, trialModeLabels, trialModes, trialModeState } from '@/components/home/trialState'
import type { GameMode } from '@/modes/config'
import type { ChallengeType } from '@/types/game'

export const challengeDescriptions: Record<ChallengeType, string> = {
  'blind-market': 'Примите торговое решение, не зная актива и даты.',
  'market-maker': 'Выставляйте котировки и управляйте спредом в реальном времени.',
  'black-swan': 'Вы уже в позиции. Рынок резко меняется. Как поступите?',
  'cross-arbitrage': 'Найдите ценовое расхождение между площадками и оцените возможность исполнения.',
}

export const challengeDurations: Record<ChallengeType, string> = {
  'blind-market': '3–4 минуты · 3 решения',
  'market-maker': '60 секунд · живой поток',
  'black-swan': '2–3 минуты · 3 фазы',
  'cross-arbitrage': '1,5–2 минуты · 5 рынков',
}

export function ChallengeCard({ challenge, featured = false }: {
  challenge: ChallengeType
  featured?: boolean
}) {
  const state = useGameStore()
  const navigate = useNavigate()
  const [hint, setHint] = useState<GameMode | null>(null)
  const [choice, setChoice] = useState<GameMode | null>(null)
  const mode = choice && trialModeState(state, challenge, choice).available
    ? choice : preferredTrialMode(state, challenge)
  const current = trialModeState(state, challenge, mode)
  const titleId = `trial-${challenge}`
  const action = mode === 'duel' ? 'Начать дуэль' : 'Начать испытание'

  return <article data-challenge={challenge} data-featured={featured || undefined}
    aria-labelledby={titleId} className="challenge-card flex h-full flex-col border border-t-2 border-ink-700 border-t-chalk-50 bg-ink-950">
    <div className="trial-card-top">
      <span>{challengeNumbers[challenge]}</span>
      {current.completed ? <span className="trial-saved-status"><Check size={12} aria-hidden />Пройдено</span>
        : current.bestPoints !== undefined ? <span className="trial-saved-status">Есть результат</span> : null}
    </div>
    <TrialSignal challenge={challenge} />
    <div className="trial-copy">
      <h3 id={titleId}>{challengeTitles[challenge]}</h3>
      <p>{challengeDescriptions[challenge]}</p>
    </div>
    <div className="trial-controls">
      <div className="trial-duration">{challengeDurations[challenge]}</div>
      <fieldset className="trial-modes">
        <legend className="sr-only">Режим — {challengeTitles[challenge]}</legend>
        {trialModes.map(option => {
          const status = trialModeState(state, challenge, option)
          const hintId = `${titleId}-${option}-hint`
          const ModeRow = status.available ? 'label' : 'div'
          return <ModeRow role={!status.available ? 'group' : undefined} key={option} className="trial-mode" data-locked={!status.available || undefined}
            tabIndex={!status.available ? 0 : undefined}
            aria-label={!status.available ? `${trialModeLabels[option]} — закрыт` : undefined}
            aria-describedby={!status.available ? hintId : undefined}
            onFocus={!status.available ? () => setHint(option) : undefined}
            onClick={!status.available ? () => setHint(option) : undefined}
            onBlur={() => setHint(null)}
            onKeyDown={event => {
              if (event.key === 'Escape') setHint(null)
              if (!status.available && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                setHint(hint === option ? null : option)
              }
            }}>

            <input type="radio" name={`mode-${challenge}`} value={option} checked={mode === option}
              disabled={!status.available} onChange={() => setChoice(option)}
              aria-label={`${trialModeLabels[option]} — ${status.available ? status.completed ? 'пройдено' : 'доступно' : status.condition}`} />
            <span className="trial-mode-icon" aria-hidden>{!status.available ? <Lock size={12} /> : <span />}</span>
            <span>{trialModeLabels[option]}</span>
            <span className="trial-mode-status">{!status.available ? status.shortCondition
              : status.completed ? <Check size={13} aria-label="Пройдено" /> : 'Открыт'}</span>
            {!status.available && <span id={hintId} role="tooltip" className="trial-mode-hint"
              hidden={hint !== option}>{status.condition}</span>}
          </ModeRow>
        })}
      </fieldset>
      <button type="button" className="challenge-action" aria-label={`${action} — ${challengeTitles[challenge]}, ${trialModeLabels[mode]}`}
        onClick={() => {
          state.setMode(mode)
          navigate(challengeRoutes[challenge], { state: { trialMode: mode } })
        }}>{action}<ArrowUpRight size={18} aria-hidden /></button>
      {current.bestPoints !== undefined && <div className="trial-result" aria-live="polite">
        {current.bestPoints !== undefined && <span>Лучший: {current.bestPoints.toLocaleString('ru-RU')} оч.</span>}
      </div>}
    </div>
  </article>
}

/** Abstract market signals; decorative, never presented as live prices. */
function TrialSignal({ challenge }: { challenge: ChallengeType }) {
  const revealClipId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (challenge !== 'cross-arbitrage') return
    const svg = svgRef.current
    const card = svg?.closest('.challenge-card')
    if (!svg || !card) return
    const motion = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    const lines = [...svg.querySelectorAll<SVGElement>('.signal-primary, .signal-secondary, .signal-spread-guide')]
    let animations: Animation[] = []
    let active = false
    let disposed = false
    const reset = () => {
      animations.forEach(animation => animation.cancel())
      animations = []
      active = false
    }
    const sync = () => {
      if (disposed) return
      if (!motion.matches) { reset(); return }
      const next = card.matches(':hover') || card.contains(document.activeElement)
      if (next === active) return
      active = next
      // Snapshot before cancelling, so leaving midway returns smoothly instead of snapping.
      const transforms = lines.map(line => getComputedStyle(line).transform)
      animations.forEach(animation => animation.cancel())
      animations = lines.map((line, index) => line.animate(active ? [
        { transform: transforms[index], offset: 0 },
        { transform: 'scaleY(1.45)', offset: .4 },
        { transform: 'scaleY(.7)', offset: .75 },
        { transform: 'scaleY(1)', offset: 1 },
      ] : [{ transform: transforms[index] }, { transform: 'scaleY(1)' }], {
        duration: active ? 1600 : 400, easing: active ? 'ease-in-out' : 'ease-out', iterations: 1,
      }))
    }
    // Focus moves between controls without replaying the cycle for every control.
    const onFocus = () => queueMicrotask(sync)
    card.addEventListener('pointerenter', sync)
    card.addEventListener('pointerleave', sync)
    card.addEventListener('focusin', onFocus)
    card.addEventListener('focusout', onFocus)
    motion.addEventListener('change', reset)
    return () => {
      disposed = true
      reset()
      card.removeEventListener('pointerenter', sync)
      card.removeEventListener('pointerleave', sync)
      card.removeEventListener('focusin', onFocus)
      card.removeEventListener('focusout', onFocus)
      motion.removeEventListener('change', reset)
    }
  }, [challenge])
  const paths: Record<ChallengeType, string[]> = {
    'blind-market': ['M0 52 L24 52 L38 42 L60 48 L78 25 L96 33 L118 12 L138 22 L160 9 L180 18 L210 4'],
    'market-maker': ['M0 18 H36 V26 H78 V34 H118 V42 H160 V50 H210', 'M0 58 H36 V50 H78 V42 H118 V34 H160 V26 H210'],
    'black-swan': ['M0 24 L30 20 L60 25 L84 18 L104 22 L116 65 L132 48 L145 58 L165 42 L183 47 L210 35'],
    'cross-arbitrage': ['M0 35 L28 32 L52 34 L78 24 L112 15 L140 22 L168 29 L190 32 L210 34', 'M0 38 L28 35 L52 38 L78 46 L112 55 L140 48 L168 39 L190 36 L210 37'],
  }
  return <div className="trial-signal" aria-hidden><svg ref={svgRef} viewBox="0 0 210 72" fill="none" preserveAspectRatio="none">
    <path d="M0 18 H210 M0 36 H210 M0 54 H210 M42 0 V72 M84 0 V72 M126 0 V72 M168 0 V72" className="signal-grid" />
    {challenge === 'blind-market' ? <>
      <defs><clipPath id={revealClipId} clipPathUnits="userSpaceOnUse">
        <rect x="-60" y="0" width="210" height="72" className="signal-reveal-window" />
      </clipPath><clipPath id={`${revealClipId}-unknown`} clipPathUnits="userSpaceOnUse">
        <rect x="150" y="0" width="60" height="72" className="signal-reveal-window" />
      </clipPath></defs>
      <g clipPath={`url(#${revealClipId}-unknown)`}>
        <path d={paths[challenge][0]} className="signal-primary signal-unknown" />
        <path d="M150 15 L168 27 L186 23 L210 42 M150 15 L168 32 L186 40 L210 52"
          className="signal-alternatives" />
      </g>
      <path d={paths[challenge][0]} clipPath={`url(#${revealClipId})`} className="signal-primary" />
      <path d="M150 0 V72" className="signal-unknown-boundary" />
    </> : <>
      {challenge === 'cross-arbitrage' && <path d="M112 15 V55" className="signal-spread-guide" />}
      {paths[challenge].map((path, index) => <path key={path} d={path} pathLength={1} className={index ? 'signal-secondary' : 'signal-primary'} />)}
    </>}
  </svg><span>{challenge === 'blind-market' ? 'SIGNAL / UNKNOWN' : challenge === 'market-maker' ? 'BID / ASK' : challenge === 'black-swan' ? 'RISK / REACTION' : 'SPREAD / EXECUTION'}</span></div>
}
