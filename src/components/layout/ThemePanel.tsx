import { useEffect, useRef } from 'react'
import { setTheme, useThemePreference } from '@/lib/theme'
import styles from './ThemePanel.module.css'

const themes = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Системная' },
] as const

/** Local theme preview, kept outside the site navigation. */
export function ThemePanel({ inline = false }: { inline?: boolean }) {
  const theme = useThemePreference()
  const panel = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) {
        panel.current?.removeAttribute('open')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <details ref={panel} className={`${styles.panel}${inline ? ` ${styles.inline}` : ''}`}>
      <summary ref={trigger} className={styles.trigger} aria-label="Тема сайта: отладка"><span aria-hidden="true">◐</span> Тема</summary>
      <fieldset className={styles.options}>
        <legend>Тема сайта</legend>
        {themes.map(({ value, label }) => (
          <label key={value}><input type="radio" name="preview-theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />{label}</label>
        ))}
        <p>Только для отладки</p>
      </fieldset>
    </details>
  )
}
