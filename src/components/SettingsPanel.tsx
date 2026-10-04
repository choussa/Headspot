import type { Preferences } from '../state/preferences'

interface Props {
  prefs: Preferences
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  onDeleteProject: () => void
}

export function SettingsPanel({ prefs, update, onDeleteProject }: Props) {
  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      <section>
        <label>Font size in the editor</label>
        <input
          type="number"
          min={8}
          max={40}
          value={prefs.fontSize}
          onChange={(e) => update('fontSize', Number(e.target.value) || 15)}
        />
      </section>
      <section>
        <label>Font family in the editor</label>
        <input
          type="text"
          value={prefs.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
        />
      </section>
      <section>
        <label>Line numbers</label>
        <select
          value={prefs.showLineNumbers ? 'normal' : 'off'}
          onChange={(e) => update('showLineNumbers', e.target.value === 'normal')}
        >
          <option value="normal">Normal</option>
          <option value="off">Off</option>
        </select>
      </section>
      <section className="settings-check">
        <label>
          <input
            type="checkbox"
            checked={prefs.disableCtrlS}
            onChange={(e) => update('disableCtrlS', e.target.checked)}
          />
          Disable browser Ctrl-S shortcut
        </label>
      </section>
      <section className="settings-check">
        <label>
          <input
            type="checkbox"
            checked={prefs.vimMode}
            onChange={(e) => update('vimMode', e.target.checked)}
          />
          Enable Vim Mode
        </label>
      </section>
      <section>
        <label>Writing direction</label>
        <div className="segmented">
          <button className="segmented-active">LTR</button>
          <button>RTL</button>
        </div>
      </section>
      <button className="danger-button" onClick={onDeleteProject}>Delete project</button>
    </div>
  )
}
