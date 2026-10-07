import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, Package } from 'lucide-react'
import { parse } from 'smol-toml'
import { packageToml } from '../storage/packagePublish'
import type { PackageConfig, ProjectFile } from '../state/workspace'

interface Props {
  text: string
  sourceFiles: ProjectFile[]
  onChange: (toml: string, cfg: PackageConfig | null) => void
}

const NAME_RE = /^[a-z][a-z0-9-]*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

function stripSlash(p?: string): string {
  return (p ?? '').replace(/^\/+/, '')
}

export function parseTomlConfig(text: string): PackageConfig | null {
  try {
    const doc = parse(text) as any
    const pkg = doc?.package
    if (!pkg || typeof pkg !== 'object') return null
    const tpl = doc?.template
    return {
      name: typeof pkg.name === 'string' ? pkg.name : '',
      version: typeof pkg.version === 'string' ? pkg.version : '',
      description: typeof pkg.description === 'string' ? pkg.description : '',
      entrypoint: pkg.entrypoint ? '/' + stripSlash(String(pkg.entrypoint)) : '/main.typ',
      isTemplate: !!tpl && typeof tpl === 'object',
      templateDir: tpl && typeof tpl === 'object' && tpl.path ? String(tpl.path) : undefined,
      templateEntrypoint: tpl && typeof tpl === 'object' && tpl.entrypoint ? '/' + stripSlash(String(tpl.entrypoint)) : undefined,
    }
  } catch {
    return null
  }
}

const inputCls = 'w-full bg-panel border border-line rounded px-2.5 py-1.5 text-fg outline-none focus:border-accent-fill transition-colors'
const selectCls = inputCls + ' appearance-none pr-7'

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-fg font-medium mb-1.5 flex items-center justify-between text-[13px]">
        <span>{label}</span>
        {hint}
      </span>
      {children}
    </label>
  )
}

export function TomlPackageForm({ text, sourceFiles, onChange }: Props) {
  const [cfg, setCfg] = useState<PackageConfig>(() => parseTomlConfig(text) ?? {
    name: '', version: '0.1.0', description: '', entrypoint: '/main.typ', isTemplate: false,
  })
  const timer = useRef<number | undefined>(undefined)

  const nameOk = NAME_RE.test(cfg.name)
  const verOk = VERSION_RE.test(cfg.version)
  const malformed = text.trim().length > 0 && parseTomlConfig(text) === null

  const pending = useRef<PackageConfig | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const apply = useCallback((next: PackageConfig) => {
    setCfg(next)
    pending.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      pending.current = null
      onChangeRef.current(packageToml(next), next)
    }, 400)
  }, [])

  useEffect(() => () => {
    if (pending.current) {
      window.clearTimeout(timer.current)
      onChangeRef.current(packageToml(pending.current), pending.current)
    }
  }, [])

  return (
    <div className="h-full overflow-auto p-6 text-sm text-fg">
      <div className="max-w-xl mx-auto flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-fg-2" />
          <h3 className="text-fg font-semibold">Package manifest</h3>
          <span className="text-xs text-fg-3">typst.toml</span>
        </div>

        {malformed && (
          <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            Could not parse typst.toml. Switch to code view to fix the syntax; edits here will overwrite the file.
          </p>
        )}

        <Field
          label="Package name"
          hint={!nameOk ? <span className="text-danger text-[11px]">lowercase letters, digits, dashes</span> : undefined}
        >
          <input className={inputCls} value={cfg.name} onChange={(e) => apply({ ...cfg, name: e.target.value })} spellCheck={false} placeholder="my-package" />
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
            placeholder="Briefly describe this package…"
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
            className="w-4 h-4 rounded border-line bg-panel accent-accent-fill"
            checked={cfg.isTemplate}
            onChange={(e) => apply({ ...cfg, isTemplate: e.target.checked })}
          />
          This package is a template
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
      </div>
    </div>
  )
}
