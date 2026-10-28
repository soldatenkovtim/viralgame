import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'market-trials-theme'
const listeners = new Set<() => void>()
let preference: ThemePreference = 'system'
let resolved: 'light' | 'dark' = 'light'
let initialized = false

function readPreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

function applyTheme() {
  resolved = preference === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : preference
  document.documentElement.dataset.theme = resolved
  listeners.forEach(listener => listener())
}

export function initializeTheme() {
  if (initialized) return
  initialized = true
  try { preference = readPreference(localStorage.getItem(STORAGE_KEY)) } catch { /* Storage is optional. */ }
  applyTheme()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      preference = readPreference(event.newValue)
      applyTheme()
    }
  })
}

export function setTheme(preferenceValue: ThemePreference) {
  preference = preferenceValue
  try { localStorage.setItem(STORAGE_KEY, preference) } catch { /* Keep the selection for this session. */ }
  applyTheme()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => resolved, () => 'light' as const)
}

export function useThemePreference() {
  return useSyncExternalStore(subscribe, () => preference, () => 'system' as const)
}
