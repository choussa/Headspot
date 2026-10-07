import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X, Search, Star, Layers, Loader2 } from 'lucide-react'
import {
  fetchTemplateIndex,
  fetchTemplateMeta,
  fetchTemplateSource,
  renderTemplate,
  type TemplateIndexEntry,
  type TemplateMeta
} from '../utils/templateEngine'

interface Props {
  onClose: () => void
  onCreate: (name: string, source: string) => void
}

/** Turn an id like `author-name` into a readable label. */
function humanize(id: string): string {
  const words = id.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id
}

export function TemplateDialog({ onClose, onCreate }: Props) {
  const [index, setIndex] = useState<TemplateIndexEntry[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [selected, setSelected] = useState<TemplateIndexEntry | null>(null)
  const [meta, setMeta] = useState<TemplateMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    fetchTemplateIndex()
      .then((list) => { setIndex(list); setIndexLoading(false) })
      .catch(() => { setError('Could not load templates. Check your connection and try again.'); setIndexLoading(false) })
  }, [])

  useEffect(() => {
    if (!selected) {
      setMeta(null)
      setValues({})
      return
    }
    let alive = true
    setMeta(null)
    setMetaLoading(true)
    fetchTemplateMeta(selected.path)
      .then((m) => {
        if (!alive) return
        setMeta(m)
        setValues(Object.fromEntries(m.variables.map((v) => [v.id, v.default ?? ''])))
      })
      .catch(() => { if (alive) setError('Could not load template metadata.') })
      .finally(() => { if (alive) setMetaLoading(false) })
    return () => { alive = false }
  }, [selected])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Focus trap + Escape, so keyboard users stay inside the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filteredIndex = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return index.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }, [index, searchQuery])

  const handleCreate = async () => {
    if (!selected) return
    setCreating(true)
    setError(null)
    try {
      const src = await fetchTemplateSource(selected.path)
      onCreate(meta?.name ?? selected.name, renderTemplate(src, values))
    } catch {
      setError('Could not create a project from this template.')
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[min(650px,90vh)] w-full max-w-[960px] flex-col overflow-hidden rounded-xl border border-line bg-app text-fg shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line p-5">
          <h2 id={titleId} className="text-lg font-semibold text-fg">Configure new project</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-fg-2 transition-colors hover:bg-raised hover:text-fg">
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-4 p-5 pb-0">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-sm focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
            <Search size={16} className="text-fg-2" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search templates"
              placeholder="Search templates"
              className="w-full border-none bg-transparent text-fg outline-none placeholder:text-fg-3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 p-5 md:flex-row">
          <div className="flex-1 overflow-y-auto rounded-lg border border-line bg-panel/30 p-5">
            {error && !selected && (
              <p role="alert" className="mb-4 text-sm text-danger">{error}</p>
            )}
            {indexLoading ? (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="aspect-[1/1.4] w-full animate-pulse rounded bg-raised" />
                    <div className="h-5 w-24 animate-pulse rounded-full bg-raised" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                {filteredIndex.map((t) => {
                  const isSelected = selected?.id === t.id
                  return (
                    <button
                      key={t.id}
                      className="group flex w-full flex-col items-center gap-3 rounded outline-none"
                      aria-pressed={isSelected}
                      onClick={() => { setSelected(t); setError(null) }}
                    >
                      <div className={`relative flex aspect-[1/1.4] w-full items-center justify-center overflow-hidden rounded bg-white transition-all ${isSelected ? 'ring-2 ring-brand ring-offset-2 ring-offset-app' : 'border border-line-2'}`}>
                        {t.thumbnailUrl ? (
                          <img src={t.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-neutral-400">
                            <Layers size={32} aria-hidden="true" />
                            <span className="px-4 text-center text-xs font-medium text-neutral-500">{t.name}</span>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <div className="rounded bg-app p-2 text-fg shadow-lg">
                            <Search size={18} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${isSelected ? 'border-brand/40 bg-brand/20 text-brand' : 'border-line bg-panel text-fg group-hover:bg-raised'}`}>
                        <Star size={12} className={isSelected ? 'fill-brand text-brand' : ''} aria-hidden="true" />
                        {t.name}
                      </div>
                    </button>
                  )
                })}

                {filteredIndex.length === 0 && !error && (
                  <div className="col-span-full py-12 text-center text-fg-2">
                    No templates found matching your search.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col overflow-y-auto pr-1 md:w-[280px]">
            {!selected ? (
              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                <Layers size={64} className="text-fg-3" aria-hidden="true" />
                <h3 className="text-lg font-medium text-fg">Select a template to get started</h3>
                <p className="text-sm leading-relaxed text-fg-2">
                  Choose a template to kick off your project. You can change everything later!
                </p>
                <p className="mt-4 text-sm leading-relaxed text-fg-2">
                  You can also browse all available templates on{' '}
                  <a href="https://typst.app/universe/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Typst Universe</a>{' '}
                  to get inspired.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pb-4">
                <h3 className="text-lg font-semibold text-fg">{meta?.name ?? selected.name}</h3>

                {selected.author && <p className="text-sm text-fg-2">By {selected.author}</p>}

                <p className="text-sm leading-relaxed text-fg-2">{meta?.description ?? selected.description}</p>

                {metaLoading && (
                  <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-fg-3">
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading options…
                  </p>
                )}

                {meta && meta.variables.length > 0 && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
                    <h4 className="text-sm font-medium text-fg">Template variables</h4>
                    {meta.variables.map((v) => (
                      <label key={v.id} className="flex flex-col gap-1.5 text-xs font-medium text-fg-2">
                        {humanize(v.id)}
                        <input
                          name={v.id}
                          className="rounded border border-line bg-panel px-2.5 py-2 text-sm text-fg outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand"
                          value={values[v.id] ?? ''}
                          onChange={(e) => setValues({ ...values, [v.id]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                )}

                {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-line bg-panel/50 p-4">
          <button
            disabled={!selected || creating}
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-md bg-accent-fill px-6 py-2 font-medium text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:bg-raised disabled:text-fg-3 disabled:hover:brightness-100"
          >
            {creating && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
