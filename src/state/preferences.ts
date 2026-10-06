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
  disableCtrlS: boolean
  vimMode: boolean
  writingDirection: 'ltr' | 'rtl'
  spellcheck: boolean
  personalDictionary: string
  previewedFile: string
  experimental: boolean
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
  disableCtrlS: true,
  vimMode: false,
  writingDirection: 'ltr',
  spellcheck: false,
  personalDictionary: '',
  previewedFile: '/main.typ',
  experimental: false,
}

const KEY = 'typst:preferences'

export function loadPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

const lightQuery = () => window.matchMedia('(prefers-color-scheme: light)')

/** The one place that writes `data-theme`. Every surface reads it through tokens. */
function applyTheme(theme: Preferences['theme']) {
  const resolved =
    theme === 'system' ? (lightQuery().matches ? 'light' : 'dark') : theme
  document.documentElement.dataset.theme = resolved
}

/** Idempotent. Called at module load so the first paint is already themed. */
let themeInitialized = false
export function initializeTheme() {
  if (typeof document === 'undefined') return
  applyTheme(loadPreferences().theme)
  if (themeInitialized) return
  themeInitialized = true
  lightQuery().addEventListener('change', onSystemThemeChange)
}

function onSystemThemeChange() {
  if (loadPreferences().theme === 'system') applyTheme('system')
}

if (typeof document !== 'undefined') initializeTheme()

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(prefs))
    applyTheme(prefs.theme)
  }, [prefs])
  const update = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      setPrefs((p) => ({ ...p, [key]: value })),
    [],
  )
  return { prefs, update }
}
