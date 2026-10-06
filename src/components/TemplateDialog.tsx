import { useEffect, useState } from 'react'
import { fetchTemplateIndex, fetchTemplateMeta, fetchTemplateSource, renderTemplate, type TemplateIndexEntry, type TemplateMeta } from '../utils/templateEngine'

interface Props {
  onClose: () => void
  onCreate: (name: string, source: string) => void
}

export function TemplateDialog({ onClose, onCreate }: Props) {
  const [index, setIndex] = useState<TemplateIndexEntry[]>([])
  const [selected, setSelected] = useState<TemplateIndexEntry | null>(null)
  const [meta, setMeta] = useState<TemplateMeta | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplateIndex().then(setIndex).catch(() => setError('Could not load templates'))
  }, [])

  useEffect(() => {
    if (!selected) return
    setMeta(null)
    fetchTemplateMeta(selected.path)
      .then((m) => {
        setMeta(m)
        setValues(Object.fromEntries(m.variables.map((v) => [v.id, v.default ?? ''])))
      })
      .catch(() => setError('Could not load template metadata'))
  }, [selected])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-fg">Start from a template</h2>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        {!selected ? (
          <div className="flex flex-col gap-2">
            {index.map((t) => (
              <button key={t.id} className="rounded-lg border border-line px-4 py-3 text-left text-sm text-fg transition-colors hover:bg-raised" onClick={() => setSelected(t)}>
                <span className="block font-medium">{t.name}</span>
                <span className="block text-xs text-fg-3">{t.description}</span>
              </button>
            ))}
            <button className="mt-2 rounded-lg border border-line px-4 py-2 text-sm text-fg-2" onClick={onClose}>Cancel</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-fg">{meta?.name ?? selected.name}</h3>
            {meta?.variables.map((v) => (
              <label key={v.id} className="flex flex-col gap-1 text-xs text-fg-2">
                {v.id}
                <input
                  className="rounded border border-line bg-app px-2 py-1.5 text-fg"
                  value={values[v.id] ?? ''}
                  onChange={(e) => setValues({ ...values, [v.id]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex gap-2 mt-2">
              <button className="rounded-lg border border-line px-4 py-2 text-sm text-fg-2" onClick={() => setSelected(null)}>Back</button>
              <button
                className="rounded-lg bg-accent-fill px-4 py-2 text-sm font-semibold text-white"
                onClick={async () => {
                  try {
                    const src = await fetchTemplateSource(selected.path)
                    onCreate(meta?.name ?? selected.name, renderTemplate(src, values))
                  } catch (e) { setError('Could not create from template') }
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
