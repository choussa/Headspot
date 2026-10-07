import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, Layers, Package, X } from 'lucide-react'
import type { PackageConfig, ProjectRecord } from '../state/workspace'
import { listPackageVersions, publishPackage, type PackageVersion } from '../storage/packagePublish'

interface Props {
  record: ProjectRecord
  ownerId: string | null
  onClose: () => void
  onUpdateConfig: (cfg: PackageConfig) => void
}

const NAME_RE = /^[a-z][a-z0-9-]*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

function slug(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'my-package'
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-fg font-medium mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {hint}
      </span>
      {children}
    </label>
  )
}

const inputCls = 'w-full bg-panel border border-line rounded px-2.5 py-1.5 text-fg outline-none focus:border-accent-fill transition-colors'
const selectCls = inputCls + ' appearance-none pr-7'

export function PackageSettings({ record, ownerId, onClose, onUpdateConfig }: Props) {
  const [cfg, setCfg] = useState<PackageConfig>(() => record.meta.packageConfig ?? {
    name: slug(record.meta.name),
    version: '0.1.0',
    description: '',
    entrypoint: '/main.typ',
    isTemplate: false,
  })
  const [releases, setReleases] = useState<PackageVersion[]>([])
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; msg?: string }>({ kind: 'idle' })
  const timer = useRef<number | undefined>(undefined)

  const nameOk = NAME_RE.test(cfg.name)
  const verOk = VERSION_RE.test(cfg.version)
  const sourceFiles = record.files.filter((f) => f.kind === 'source')

  const apply = useCallback((next: PackageConfig) => {
    setCfg(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onUpdateConfig(next), 400)
  }, [onUpdateConfig])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const refresh = useCallback(async () => {
    if (!ownerId) return
    setReleases(await listPackageVersions(ownerId))
  }, [ownerId])

  useEffect(() => { void refresh() }, [refresh])

  const doPublish = async () => {
    if (!ownerId || !nameOk || !verOk || status.kind === 'busy') return
    window.clearTimeout(timer.current)
    onUpdateConfig(cfg)
    setStatus({ kind: 'busy' })
    try {
      const v = await publishPackage({ ownerId, record, config: cfg })
      setStatus({ kind: 'done', msg: `Published ${v.name} v${v.version}` })
      await refresh()
    } catch (e) {
      setStatus({ kind: 'error', msg: e instanceof Error ? e.message : 'Publish failed' })
    }
  }

  const close = () => {
    window.clearTimeout(timer.current)
    onUpdateConfig(cfg)
    onClose()
  }

  const nameReleases = releases.filter((r) => r.name === cfg.name)

  return (
    <div className="fixed inset-0 z-50 bg-body text-sm flex flex-col text-fg" role="dialog" aria-label="Package and template settings">
      <div className="border-b border-line px-4 py-2 flex items-center justify-between bg-topbar shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <Package size={15} className="text-fg-2" />
          Package & template
        </div>
        <div className="flex items-center gap-3">
          {status.msg && (
            <span className={`text-xs ${status.kind === 'error' ? 'text-danger' : 'text-fg-2'}`} role="status">
              {status.msg}
            </span>
          )}
          <button
            className="bg-panel border border-line px-3 py-1.5 rounded hover:bg-raised disabled:opacity-50"
            onClick={() => void doPublish()}
            disabled={!nameOk || !verOk || !ownerId || status.kind === 'busy'}
          >
            {status.kind === 'busy' ? 'Publishing…' : 'Publish'}
          </button>
          <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Close" aria-label="Close" onClick={close}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex h-full min-h-0">
        <section className="w-1/2 p-6 border-r border-line flex flex-col gap-5 overflow-y-auto">
          <div>
            <h3 className="text-fg font-semibold mb-1">About your package</h3>
            <p className="text-xs text-fg-3">Publish this project as a private package or template. Collaborators import it with <code className="text-fg-2">@local/{cfg.name || 'name'}:{cfg.version || '0.0.0'}</code>.</p>
          </div>

          <Field
            label="Package name"
            hint={!nameOk ? <span className="text-danger text-[11px]">lowercase letters, digits, dashes</span> : undefined}
          >
            <input className={inputCls} value={cfg.name} onChange={(e) => apply({ ...cfg, name: e.target.value })} spellCheck={false} />
          </Field>

          <Field
            label="Version"
            hint={!verOk ? <span className="text-danger text-[11px]">semver, e.g. 0.1.0</span> : undefined}
          >
            <input className={inputCls} value={cfg.version} onChange={(e) => apply({ ...cfg, version: e.target.value })} spellCheck={false} />
          </Field>

          <Field label="Description">
            <textarea
              className={inputCls + ' resize-none'}
              rows={3}
              value={cfg.description}
              onChange={(e) => apply({ ...cfg, description: e.target.value })}
            />
          </Field>

          <Field label="Entrypoint">
            <div className="relative">
              <select className={selectCls} value={cfg.entrypoint} onChange={(e) => apply({ ...cfg, entrypoint: e.target.value })}>
                {sourceFiles.map((f) => (
                  <option key={f.path} value={f.path}>{f.path}</option>
                ))}
              </select>
              <ChevronsUpDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2" />
            </div>
          </Field>

          <label className="flex items-center gap-2 text-fg">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-line bg-panel accent-blue-500"
              checked={cfg.isTemplate}
              onChange={(e) => apply({ ...cfg, isTemplate: e.target.checked })}
            />
            Use as template
          </label>

          {cfg.isTemplate && (
            <>
              <Field label="Template directory">
                <input className={inputCls} value={cfg.templateDir ?? ''} placeholder="template" onChange={(e) => apply({ ...cfg, templateDir: e.target.value })} spellCheck={false} />
              </Field>
              <Field label="Template entrypoint">
                <div className="relative">
                  <select className={selectCls} value={cfg.templateEntrypoint ?? cfg.entrypoint} onChange={(e) => apply({ ...cfg, templateEntrypoint: e.target.value })}>
                    {sourceFiles.map((f) => (
                      <option key={f.path} value={f.path}>{f.path}</option>
                    ))}
                  </select>
                  <ChevronsUpDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2" />
                </div>
              </Field>
            </>
          )}

          <div>
            <h3 className="text-fg font-medium mb-1.5">Shared packages</h3>
            <div className="flex flex-col">
              {releases.length === 0 && <p className="text-xs text-fg-3 p-3 border border-line first:rounded-t-md last:rounded-b-md bg-panel">No packages published yet.</p>}
              {releases.map((r) => {
                const selected = r.name === cfg.name && r.version === cfg.version
                return (
                  <button
                    key={r.id}
                    onClick={() => apply({ ...cfg, name: r.name, version: r.version, description: r.description, entrypoint: r.entrypoint, isTemplate: r.isTemplate })}
                    className={`flex items-center justify-between p-3 border -mb-px first:rounded-t-md last:rounded-b-md text-left ${selected ? 'bg-blue-500/10 border-blue-500/50 relative z-10' : 'bg-panel border-line hover:bg-raised'}`}
                  >
                    <span className="flex items-center gap-2">
                      {r.isTemplate ? <Layers size={14} className="text-fg-2" /> : <Package size={14} className="text-fg-2" />}
                      <span className="font-medium">{r.name}</span>
                      {r.isTemplate && <span className="text-[10px] uppercase tracking-wide text-fg-3 border border-line rounded px-1">template</span>}
                    </span>
                    <span className="text-fg-2 text-xs">v{r.version}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="w-1/2 p-6 flex flex-col gap-4 bg-panel/50 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-fg font-semibold">Releases</h3>
            <span className="text-xs text-fg-3">{nameReleases.length} version{nameReleases.length === 1 ? '' : 's'}</span>
          </div>

          {nameReleases.length === 0 ? (
            <p className="text-xs text-fg-3">No releases for <span className="text-fg-2 font-medium">{cfg.name || 'this package'}</span> yet. Fill in the details and press Publish.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {nameReleases.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-line rounded bg-panel">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{r.version}</span>
                      {r.isTemplate && <span className="text-[10px] uppercase tracking-wide text-fg-3 border border-line rounded px-1">template</span>}
                    </div>
                    <p className="text-xs text-fg-3 truncate mt-0.5">{r.description || r.storagePath}</p>
                  </div>
                  <span className="text-xs text-fg-2 shrink-0 ml-3">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-fg-3 border-t border-line pt-3 mt-auto">
            Packages are stored in your private <code className="text-fg-2">private_packages</code> bucket and are only resolvable inside your workspace.
          </p>
        </section>
      </div>
    </div>
  )
}
