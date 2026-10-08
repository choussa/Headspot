import { useEffect, useId, useState } from 'react'
import { AlignLeft, AlignRight } from 'lucide-react'
import type { Preferences } from '../state/preferences'
import type { ProjectRecord } from '../state/workspace'
import { listFolders, type FolderMeta } from '../storage/cloudStore'

interface Props {
  prefs: Preferences
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  onRequestDelete: () => void
  record?: ProjectRecord | null
  onRename?: (name: string) => void
  onMoveFolder?: (folderId: string | null) => void
}

export function SettingsPanel({ prefs, update, onRequestDelete, record, onRename, onMoveFolder }: Props) {
  const [folders, setFolders] = useState<FolderMeta[]>([])
  const fontFamilyId = useId()
  const dictionaryId = useId()
  useEffect(() => {
    void listFolders().then(setFolders)
  }, [])
  const sourceFiles = (record?.files ?? []).filter((f) => f.kind === 'source')
  return (
    <div className="side-panel h-full bg-panel border-r border-line flex flex-col shrink-0">
      <div className="px-5 py-4 font-semibold text-fg border-b border-line">Settings</div>
      <div className="p-5 flex flex-col gap-8 overflow-y-auto text-[13px] flex-1">
        <section>
          <h3 className="text-fg font-semibold mb-4 text-[14px]">Project settings</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Name</span>
              <input
                className="bg-app border border-line rounded px-2.5 py-1.5 w-[140px] text-fg outline-none focus:border-accent-fill"
                defaultValue={record?.meta.name ?? ''}
                key={record?.meta.id}
                onBlur={(e) => onRename?.(e.target.value.trim())}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Location</span>
              <select
                className="bg-app border border-line rounded px-2 py-1.5 w-[140px] text-fg outline-none focus:border-accent-fill"
                value={record?.meta.folderId ?? ''}
                onChange={(e) => onMoveFolder?.(e.target.value || null)}
              >
                <option value="">Projects</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Compiler</span>
              <select className="bg-app border border-line rounded px-2 py-1.5 w-[140px] text-fg outline-none focus:border-accent-fill" disabled>
                <option>Typst 0.14.1</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-fg font-semibold mb-4 text-[14px]">Export and preview</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Previewed file</span>
              <select
                className="bg-app border border-line rounded px-2 py-1.5 w-[140px] text-fg outline-none focus:border-accent-fill"
                value={prefs.previewedFile}
                onChange={(e) => update('previewedFile', e.target.value)}
              >
                {sourceFiles.map((f) => (
                  <option key={f.path} value={f.path}>{f.path}</option>
                ))}
              </select>
            </label>
            <label className="flex items-start justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="text-fg-2 group-hover:text-fg transition-colors">Experimental compiler features</span>
                <span className="text-xs text-fg-3 mt-0.5">Try unstable compiler options.</span>
              </div>
              <input type="checkbox" className="accent-accent-fill mt-1 w-3.5 h-3.5" checked={prefs.experimental} onChange={(e) => update('experimental', e.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Invert preview</span>
              <input type="checkbox" className="accent-accent-fill w-3.5 h-3.5" checked={prefs.invertPreview} onChange={(e) => update('invertPreview', e.target.checked)} />
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-fg font-semibold mb-4 text-[14px]">Editor settings</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Font size in the editor</span>
              <input
                type="number"
                min={8}
                max={32}
                className="bg-app border border-line rounded px-2.5 py-1.5 w-16 text-right text-fg outline-none focus:border-accent-fill"
                value={prefs.fontSize}
                onChange={(e) => update('fontSize', Math.min(32, Math.max(8, Number(e.target.value) || 15)))}
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Line numbers</span>
              <select
                className="bg-app border border-line rounded px-2 py-1.5 w-24 text-fg outline-none focus:border-accent-fill"
                value={prefs.showLineNumbers ? 'normal' : 'off'}
                onChange={(e) => update('showLineNumbers', e.target.value === 'normal')}
              >
                <option value="normal">Normal</option>
                <option value="off">Off</option>
              </select>
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-fg-2">Writing direction</span>
              <div className="flex border border-line rounded bg-app overflow-hidden">
                <button
                  type="button"
                  aria-label="Left to right"
                  aria-pressed={prefs.writingDirection === 'ltr'}
                  onClick={() => update('writingDirection', 'ltr')}
                  className={`px-2 py-1 flex items-center justify-center ${prefs.writingDirection === 'ltr' ? 'bg-accent-fill/20 text-accent' : 'hover:bg-raised text-fg-2'}`}
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Right to left"
                  aria-pressed={prefs.writingDirection === 'rtl'}
                  onClick={() => update('writingDirection', 'rtl')}
                  className={`px-2 py-1 border-l border-line flex items-center justify-center ${prefs.writingDirection === 'rtl' ? 'bg-accent-fill/20 text-accent' : 'hover:bg-raised text-fg-2'}`}
                >
                  <AlignRight size={14} />
                </button>
              </div>
            </label>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={fontFamilyId} className="text-fg-2">Font family in the editor</label>
              <input
                id={fontFamilyId}
                type="text"
                className="bg-app border border-line rounded px-2.5 py-1.5 w-full text-fg outline-none focus:border-accent-fill"
                value={prefs.fontFamily}
                onChange={(e) => update('fontFamily', e.target.value)}
              />
            </div>

            <label className="flex items-center justify-between">
              <span className="text-fg-2">Disable the browser's Ctrl-S shortcut</span>
              <input
                type="checkbox"
                className="accent-accent-fill w-3.5 h-3.5"
                checked={prefs.disableCtrlS}
                onChange={(e) => update('disableCtrlS', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-fg-2">Spellcheck</span>
              <input type="checkbox" className="accent-accent-fill w-3.5 h-3.5" checked={prefs.spellcheck} onChange={(e) => update('spellcheck', e.target.checked)} />
            </label>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={dictionaryId} className="text-fg-2">Personal dictionary (one word per line)</label>
              <textarea
                id={dictionaryId}
                className="bg-app border border-line rounded px-2.5 py-1.5 w-full text-fg outline-none focus:border-accent-fill"
                rows={3}
                value={prefs.personalDictionary}
                onChange={(e) => update('personalDictionary', e.target.value)}
              />
            </div>

            <label className="flex items-start justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="text-fg-2 group-hover:text-fg transition-colors">Vim mode</span>
                <span className="text-xs text-fg-3 mt-0.5">Applies keybindings as known from Vim.</span>
              </div>
              <input
                type="checkbox"
                className="accent-accent-fill mt-1 w-3.5 h-3.5"
                checked={prefs.vimMode}
                onChange={(e) => update('vimMode', e.target.checked)}
              />
            </label>
          </div>
        </section>

        <div className="mt-2">
          <button
            type="button"
            className="w-full rounded border border-danger text-danger hover:bg-danger-fill hover:text-white transition-colors px-4 py-2 font-medium"
            onClick={onRequestDelete}
          >
            Delete project
          </button>
        </div>
      </div>
    </div>
  )
}
