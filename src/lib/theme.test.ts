import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let systemDark = false
let stored: string | null = null
let onSystemChange: () => void
let onStorage: (event: { key: string | null; newValue: string | null }) => void
const root = { dataset: {} as Record<string, string> }

beforeEach(() => {
  vi.resetModules()
  systemDark = false
  stored = null
  root.dataset = {}
  vi.stubGlobal('document', { documentElement: root })
  vi.stubGlobal('localStorage', {
    getItem: () => stored,
    setItem: (_key: string, value: string) => { stored = value },
  })
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: systemDark,
      addEventListener: (_type: string, listener: () => void) => { onSystemChange = listener },
    }),
    addEventListener: (_type: string, listener: typeof onStorage) => { onStorage = listener },
  })
})

afterEach(() => vi.unstubAllGlobals())

it('restores the saved theme even when the system preference differs', async () => {
  stored = 'dark'
  const { initializeTheme } = await import('./theme')
  initializeTheme()
  expect(root.dataset.theme).toBe('dark')
})

it('follows system changes only while the system option is selected', async () => {
  const { initializeTheme, setTheme } = await import('./theme')
  initializeTheme()
  systemDark = true
  onSystemChange()
  expect(root.dataset.theme).toBe('dark')
  setTheme('light')
  onSystemChange()
  expect(root.dataset.theme).toBe('light')
  expect(stored).toBe('light')
  setTheme('system')
  expect(root.dataset.theme).toBe('dark')
})

it('syncs the selection across tabs and resets to system when storage is cleared', async () => {
  const { initializeTheme } = await import('./theme')
  initializeTheme()
  onStorage({ key: 'market-trials-theme', newValue: 'dark' })
  expect(root.dataset.theme).toBe('dark')
  onStorage({ key: 'unrelated', newValue: 'light' })
  expect(root.dataset.theme).toBe('dark')
  onStorage({ key: null, newValue: null })
  expect(root.dataset.theme).toBe('light')
})

it('keeps theme selection usable when browser storage is unavailable', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new Error('Storage blocked') },
    setItem: () => { throw new Error('Storage blocked') },
  })
  const { initializeTheme, setTheme } = await import('./theme')
  initializeTheme()
  setTheme('dark')
  expect(root.dataset.theme).toBe('dark')
})
