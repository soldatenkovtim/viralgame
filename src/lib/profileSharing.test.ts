import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareProfileImage } from './sharing'
const file = new File(['png'], 'profile.png', { type: 'image/png' })
afterEach(() => vi.unstubAllGlobals())
describe('sharing a local profile image', () => {
  it('shares the actual image with no misleading profile URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await shareProfileImage(file)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Рыночный вызов — торговый профиль', files: [file] })
  })
  it('requests download fallback if file sharing is unsupported', async () => {
    const share = vi.fn()
    vi.stubGlobal('navigator', { share, canShare: () => false })
    expect(await shareProfileImage(file)).toBe('unavailable')
    expect(share).not.toHaveBeenCalled()
    vi.stubGlobal('navigator', {})
    expect(await shareProfileImage(file)).toBe('unavailable')
  })
  it('treats cancellation separately without fallback or success', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) })
    expect(await shareProfileImage(file)).toBe('cancelled')
  })
  it('reports failures without claiming the image was sent', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new Error('denied')) })
    expect(await shareProfileImage(file)).toBe('failed')
  })
  it('waits for the native share promise before reporting completion', async () => {
    let finish!: () => void
    vi.stubGlobal('navigator', { canShare: () => true, share: () => new Promise<void>(resolve => { finish = resolve }) })
    let settled = false
    const pending = shareProfileImage(file).then(result => { settled = true; return result })
    await Promise.resolve()
    expect(settled).toBe(false)
    finish()
    expect(await pending).toBe('shared')
  })
})
