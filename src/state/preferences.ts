import { useCallback, useEffect, useState } from 'react'

export interface Preferences {
  showToolbar: boolean
  wrapLines: boolean
  showLineNumbers: boolean
  scrollOnType: boolean
  splitVertical: boolean
  showBothPanels: boolean
  theme: 'light' | 'dark' | 'system'
  invertPreview: boolean
  fontSize: number
  fontFamily: string
  vimMode: boolean
  disableCtrlS: boolean
}

const DEFAULTS: Preferences = {
  showToolbar: true,
  wrapLines: true,
  showLineNumbers: true,
  scrollOnType: true,
  splitVertical: true,
  showBothPanels: true,
  theme: 'dark',
  invertPreview: false,
  fontSize: 15,
  fontFamily: '"Cascadia Mono", monospace',
  vimMode: false,
  disableCtrlS: true,
}

const KEY = 'headspot:preferences'

export function loadPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(prefs))
    const resolved =
      prefs.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : prefs.theme
    document.documentElement.dataset.theme = resolved
  }, [prefs])
  const update = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      setPrefs((p) => ({ ...p, [key]: value })),
    [],
  )
  return { prefs, update }
}
