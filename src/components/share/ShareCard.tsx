import { useEffect, useRef, useState } from 'react'
import { Check, Download, Link2, Send } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import { TOTAL_CHALLENGES } from '@/lib/constants'
import { traitLabels, type TraitKey } from '@/lib/profile'
import {
  buildProfileShareUrl,
  buildTelegramUrl,
  copyToClipboard,
  shareOrCopy,
} from '@/lib/sharing'
import type { TradingProfile } from '@/types/game'

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

/** Три характеристики на карточке — иначе она перестаёт читаться превью-картинкой. */
const CARD_TRAITS: TraitKey[] = ['marketSense', 'riskControl', 'adaptability']

export function ShareCard({
  profile,
  playerName,
}: {
  profile: TradingProfile
  playerName?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const shareUrl = buildProfileShareUrl(profile.archetype)
  const shareText = `Мой профиль в Market Trials — ${profile.archetype}. Какой профиль получится у тебя?`

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setScale(width / CARD_WIDTH)
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const handleDownload = async () => {
    const node = cardRef.current
    if (!node) return

    const dataUrl = await toPng(node, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      pixelRatio: 2,
      skipFonts: true,
      backgroundColor: '#f5f5f1',
    })

    const link = document.createElement('a')
    link.download = 'market-trials.png'
    link.href = dataUrl
    link.click()

    trackEvent('share_card_downloaded', { archetype: profile.archetype })
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2400)
  }

  const handleShare = async () => {
    trackEvent('challenge_shared', { channel: 'profile', archetype: profile.archetype })
    const outcome = await shareOrCopy({
      title: 'Market Trials',
      text: shareText,
      url: shareUrl,
    })
    if (outcome !== 'failed') {
      setShared(true)
      window.setTimeout(() => setShared(false), 2400)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={frameRef}
        className="w-full overflow-hidden rounded-xl border border-ink-700"
        style={{ height: CARD_HEIGHT * scale }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          }}
        >
          <CardArtwork ref={cardRef} profile={profile} playerName={playerName} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={handleDownload}>
          <Download className="h-4 w-4" aria-hidden />
          Скачать карточку
        </Button>

        <Button size="lg" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4 text-market-up" aria-hidden />
              Скопировано
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" aria-hidden />
              Скопировать ссылку
            </>
          )}
        </Button>

        <Button size="lg" onClick={handleShare}>
          {shared ? (
            <>
              <Check className="h-4 w-4 text-market-up" aria-hidden />
              Готово
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Отправить
            </>
          )}
        </Button>

        <a
          href={buildTelegramUrl(shareUrl, shareText)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-13 items-center rounded-lg border border-ink-600 bg-ink-850 px-5 text-sm font-medium text-chalk-50 transition-colors hover:border-ink-500"
        >
          Отправить в Telegram
        </a>
      </div>
    </div>
  )
}

function CardArtwork({
  ref,
  profile,
  playerName,
}: {
  ref: React.Ref<HTMLDivElement>
  profile: TradingProfile
  playerName?: string
}) {
  return (
    <div
      ref={ref}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#f5f5f1',
        color: '#141416',
        padding: 72,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 18,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: '#50504f',
            }}
          >
            Market Trials
          </span>
          {playerName ? (
            <span style={{ fontSize: 18, color: '#666661' }}>{playerName}</span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 16, letterSpacing: '0.18em', color: '#6531b2' }}>
            АРХЕТИП СЕССИИ
          </span>
          <span
            style={{
              fontSize: 62,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
            }}
          >
            {profile.archetype}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 620 }}>
          {CARD_TRAITS.map((trait) => (
            <div key={trait} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: 20, color: '#3f3f42' }}>
                  {traitLabels[trait]}
                </span>
                <span style={{ fontSize: 28, fontWeight: 300 }}>{profile[trait]}</span>
              </div>
              <div
                style={{
                  height: 3,
                  width: '100%',
                  backgroundColor: '#d4d4ce',
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    height: 3,
                    width: `${profile[trait]}%`,
                    backgroundColor: '#7741c8',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderTop: '1px solid #d4d4ce',
          paddingTop: 28,
        }}
      >
        <span style={{ fontSize: 22, color: '#50504f' }}>
          {TOTAL_CHALLENGES} / {TOTAL_CHALLENGES} испытаний
        </span>
        <span style={{ fontSize: 26, color: '#141416' }}>
          Какой профиль получится у тебя?
        </span>
      </div>
    </div>
  )
}
