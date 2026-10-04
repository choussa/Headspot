import { useState } from 'react'
import type { Preferences } from '../state/preferences'

interface Props {
  prefs: Preferences
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  onRequestDelete: () => void
  onLoadLocalFonts?: () => Promise<void>
}

export function SettingsPanel({ prefs, update, onRequestDelete, onLoadLocalFonts }: Props) {
  const [fontsStatus, setFontsStatus] = useState<string | null>(null)
  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      <section>
        <label htmlFor="set-font-size">Editor font size</label>
        <input
          id="set-font-size"
          type="number"
          min={8}
          max={40}
          value={prefs.fontSize}
          onChange={(e) => update('fontSize', Number(e.target.value) || 15)}
        />
      </section>
      <section>
        <label htmlFor="set-font-family">Editor font family</label>
        <input
          id="set-font-family"
          type="text"
          value={prefs.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
        />
      </section>
      <section>
        <label htmlFor="set-line-numbers">Line numbers</label>
        <select
          id="set-line-numbers"
          value={prefs.showLineNumbers ? 'normal' : 'off'}
          onChange={(e) => update('showLineNumbers', e.target.value === 'normal')}
        >
          <option value="normal">Normal</option>
          <option value="off">Off</option>
        </select>
      </section>
      <section className="settings-check">
        <label htmlFor="set-ctrl-s">
          <input
            id="set-ctrl-s"
            type="checkbox"
            checked={prefs.disableCtrlS}
            onChange={(e) => update('disableCtrlS', e.target.checked)}
          />
          Disable browser Ctrl-S shortcut
        </label>
      </section>
      {onLoadLocalFonts && (
        <section>
          <button
            type="button"
            className="file-asset-btn rounded px-2 py-1 text-xs"
            disabled={fontsStatus === 'Loading…'}
            onClick={async () => {
              setFontsStatus('Loading…')
              try {
                await onLoadLocalFonts()
                setFontsStatus('Local fonts loaded')
              } catch (e) {
                setFontsStatus(e instanceof Error ? e.message : 'Could not load fonts')
              }
            }}
          >
            Load local fonts
          </button>
          {fontsStatus && <p className="mt-1 text-xs opacity-70">{fontsStatus}</p>}
        </section>
      )}
      <button type="button" className="danger-button" onClick={onRequestDelete}>
        Delete project
      </button>
    </div>
  )
}
