import { useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { Button } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import { archetypeTagline, traitLabels } from '@/lib/profile'
import { shareCardTraits } from '@/lib/profilePresentation'
import { shareProfileImage } from '@/lib/sharing'
import type { TradingProfile } from '@/types/game'

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

export function ShareCard({ profile, playerName }: { profile: TradingProfile; playerName?: string }) {
  return <PreparedShareCard key={JSON.stringify([profile, playerName])} profile={profile} playerName={playerName} />
}

function PreparedShareCard({ profile, playerName }: { profile: TradingProfile; playerName?: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / CARD_WIDTH))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  // Prepare the file ahead of the click so native sharing retains user activation.
  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    const prepare = async () => {
      await document.fonts.ready
      await Promise.all([document.fonts.load('800 52px Geist', profile.archetype), document.fonts.load('400 22px Geist', 'Рыночный вызов')])
      if (cancelled || !cardRef.current) return
      const blob = await toBlob(cardRef.current, {
        width: CARD_WIDTH, height: CARD_HEIGHT, pixelRatio: 1,
        backgroundColor: '#f5f5f1',
      })
      if (cancelled) return
      if (!blob) throw new Error('Image export failed')
      url = URL.createObjectURL(blob)
      setImage({ file: new File([blob], 'Рыночный вызов.png', { type: 'image/png' }), url })
    }
    void prepare().catch(() => {
      if (!cancelled) { setError(true); setStatus('Не удалось подготовить изображение. Попробуйте ещё раз.') }
    })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [profile, playerName, revision])

  const download = () => {
    if (!image) return
    const link = document.createElement('a')
    link.download = image.file.name
    link.href = image.url
    link.click()
    trackEvent('share_card_downloaded', { archetype: profile.archetype })
  }

  const handleShare = async () => {
    if (!image || sharing) return
    setSharing(true)
    setStatus('')
    const outcome = await shareProfileImage(image.file)
    if (outcome === 'shared') {
      setStatus('Карточка передана в приложение для отправки.')
      trackEvent('challenge_shared', { channel: 'profile_image', archetype: profile.archetype })
    } else if (outcome === 'unavailable') {
      download()
      setStatus('Браузер не поддерживает отправку изображения. Карточка скачана — прикрепите её к сообщению.')
    } else if (outcome === 'failed') {
      setStatus('Не удалось поделиться. Скачайте карточку и прикрепите её к сообщению.')
    }
    setSharing(false)
  }

  return <div className="mx-auto flex w-full min-w-0 max-w-[960px] flex-col gap-4">
    <div ref={frameRef} className="relative w-full overflow-hidden rounded-xl border border-ink-700 bg-[#f5f5f1]" style={{ aspectRatio: '1200 / 630' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: CARD_WIDTH, height: CARD_HEIGHT }}>
        <CardArtwork ref={cardRef} profile={profile} playerName={playerName} />
      </div>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" size="lg" disabled={!image} onClick={() => { download(); setStatus('Карточка скачана · PNG, 1200 × 630.') }}>
        <Download size={16} aria-hidden />Скачать карточку
      </Button>
      <Button size="lg" disabled={!image || sharing} onClick={handleShare}>
        <Share2 size={16} aria-hidden />{sharing ? 'Отправка…' : 'Поделиться'}
      </Button>
      {error && <Button onClick={() => { setError(false); setStatus(''); setRevision(value => value + 1) }}>Повторить подготовку</Button>}
    </div>
    <p className="max-w-2xl text-xs leading-relaxed text-chalk-500">PNG · 1200 × 630. Профиль сохранён только в этом браузере. Поделиться можно изображением; публичной ссылки на результат нет.</p>
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-chalk-400">{status || (!image && !error ? 'Подготавливаем изображение…' : '')}</p>
  </div>
}

function CardArtwork({ ref, profile, playerName }: { ref: React.Ref<HTMLDivElement>; profile: TradingProfile; playerName?: string }) {
  return <div ref={ref} data-profile-artwork style={{ width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#f5f5f1', color: '#141416', padding: '48px 64px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: 'Geist, sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.06em' }}>РЫНОЧНЫЙ ВЫЗОВ<span style={{ color: '#7741c8' }}>_</span></span>
      <span style={{ fontSize: 18, color: '#6531b2' }}>Ваш торговый профиль</span>
    </div>
    <div style={{ marginTop: 40 }}>
      <div style={{ fontSize: 52, lineHeight: 1.06, fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 1050, overflowWrap: 'break-word' }}>{profile.archetype}</div>
      <div style={{ fontSize: 22, lineHeight: 1.4, color: '#50504f', marginTop: 16, maxWidth: 1000 }}>{archetypeTagline(profile.archetype)}</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 36, marginTop: 'auto', marginBottom: 'auto', paddingTop: 24 }}>
      {shareCardTraits(profile).map(trait => <div key={trait}>
        <div style={{ fontSize: 20, color: '#50504f', marginBottom: 10 }}>{traitLabels[trait]}</div>
        <div style={{ fontSize: 36, lineHeight: 1, fontWeight: 400 }}>{profile[trait]}<span style={{ fontSize: 18, color: '#6b6b65' }}> / 100</span></div>
        <div style={{ height: 4, width: '100%', backgroundColor: '#d4d4ce', marginTop: 16 }}><div style={{ height: 4, width: `${profile[trait]}%`, backgroundColor: '#7741c8' }} /></div>
      </div>)}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginTop: 32, borderTop: '1px solid #d4d4ce', paddingTop: 20, fontSize: 17, color: '#50504f' }}>
      <span>4/4 испытаний пройдено</span>
      {playerName && <span style={{ maxWidth: 400, overflowWrap: 'anywhere' }}>{playerName}</span>}
      <span>Basis Labs · Рыночный вызов</span>
    </div>
  </div>
}
