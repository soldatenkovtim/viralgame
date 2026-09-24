import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import {
  buildShareUrl,
  buildTelegramUrl,
  challengeShareTitles,
  shareOrCopy,
  type SharePayload,
} from '@/lib/sharing'

/**
 * Главная виральная механика: отправляется не «игра», а конкретный рынок,
 * который другой трейдер пройдёт по тому же seed.
 */
export function ShareChallengeButton({ payload }: { payload: SharePayload }) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied'>('idle')
  const url = buildShareUrl(payload)
  const title = challengeShareTitles[payload.t]
  const text = `Прошёл сценарий «${title}» в Market Trials. Пройди тот же рынок и сравним решения.`

  const handleShare = async () => {
    trackEvent('challenge_shared', {
      challengeType: payload.t,
      scenarioId: payload.s,
      seed: payload.d,
    })

    const outcome = await shareOrCopy({ title: 'Market Trials', text, url })
    if (outcome === 'shared') setState('shared')
    if (outcome === 'copied') setState('copied')
    if (outcome !== 'failed') window.setTimeout(() => setState('idle'), 2600)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="lg" onClick={handleShare}>
        {state === 'idle' ? (
          <>
            <Send className="h-4 w-4" aria-hidden />
            Отправить этот рынок другому трейдеру
          </>
        ) : (
          <>
            <Check className="h-4 w-4 text-market-up" aria-hidden />
            {state === 'copied' ? 'Ссылка скопирована' : 'Отправлено'}
          </>
        )}
      </Button>

      <a
        href={buildTelegramUrl(url, text)}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          trackEvent('challenge_shared', { challengeType: payload.t, channel: 'telegram' })
        }
        className="inline-flex min-h-11 items-center rounded-lg border border-ink-700 px-4 text-sm text-chalk-400 transition-colors hover:border-ink-500 hover:text-chalk-50"
      >
        Отправить в Telegram
      </a>
    </div>
  )
}
