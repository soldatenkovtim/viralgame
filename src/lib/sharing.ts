import type { ChallengeType } from '@/types/game'

/**
 * Данные shared-ссылки. Ключи короткие намеренно: вся полезная нагрузка
 * должна умещаться в URL, потому что бэкенда у прототипа нет.
 */
export interface SharePayload {
  /** challenge type */
  t: ChallengeType
  /** scenarioId */
  s: string
  /** seed */
  d: number
  /** результат отправителя, % */
  r: number
  /** решения отправителя — короткие подписи для сравнения */
  a: string[]
  /** экспозиция отправителя после каждого решения */
  e?: number[]
  /** ник отправителя, если он его вводил */
  n?: string
}

/* Base64 в URL-safe варианте, корректный для кириллицы. */

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSharePayload(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload))
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as SharePayload
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.t || !parsed.s || typeof parsed.d !== 'number') return null
    if (!Array.isArray(parsed.a)) return null
    return parsed
  } catch {
    return null
  }
}

export function buildShareUrl(payload: SharePayload): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/challenge/${payload.t}/shared?data=${encodeSharePayload(payload)}`
}

export function buildProfileShareUrl(archetype: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/?a=${encodeURIComponent(archetype)}`
}

export const challengeShareTitles: Record<ChallengeType, string> = {
  'blind-market': 'Слепой рынок',
  'market-maker': 'Маркет-мейкер',
  'black-swan': 'Рыночный шок',
}

export function buildTelegramUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Упадём в ручной fallback ниже.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export async function shareOrCopy(options: {
  title: string
  text: string
  url: string
}): Promise<'shared' | 'copied' | 'failed'> {
  if (canUseWebShare()) {
    try {
      await navigator.share(options)
      return 'shared'
    } catch (error) {
      // Пользователь мог просто закрыть системное окно — это не ошибка.
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed'
    }
  }

  const copied = await copyToClipboard(options.url)
  return copied ? 'copied' : 'failed'
}
