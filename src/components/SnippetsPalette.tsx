import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap } from 'lucide-react'

export interface Snippet {
  label: string
  insert: string
}

export const TYPST_SNIPPETS: Snippet[] = [
  { label: 'Heading 1', insert: '= ' },
  { label: 'Heading 2', insert: '== ' },
  { label: 'Heading 3', insert: '=== ' },
  { label: 'Strong text', insert: '**text**' },
  { label: 'Emphasized text', insert: '_text_' },
  { label: 'Bullet list', insert: '- ' },
  { label: 'Numbered list', insert: '+ ' },
  { label: 'Term list', insert: '/ Term: Definition' },
  { label: 'Table', insert: '#table(columns: 2,\n  [Header A], [Header B],\n  [Cell], [Cell],\n)' },
  { label: 'Figure with image', insert: '#figure(\n  image("assets/", width: 60%),\n  caption: [Figure caption],\n)' },
  { label: 'Image', insert: '#image("assets/")' },
  { label: 'Link', insert: '#link("https://")[text]' },
  { label: 'Footnote', insert: '#footnote[]' },
  { label: 'Quote', insert: '#quote[Quoted text]' },
  { label: 'Inline math', insert: '$x^2$' },
  { label: 'Display math', insert: '$\n  x^2 + y^2 = z^2\n$' },
  { label: 'Pagebreak', insert: '#pagebreak()' },
  { label: 'Outline', insert: '#outline(depth: 3)' },
  { label: 'Bibliography', insert: '#bibliography("refs.bib")' },
  { label: 'Columns', insert: '#columns(2)[\n  \n]' },
  { label: 'Raw block', insert: '```\n\n```' },
  { label: 'Function definition', insert: '#let name(arg) = {\n  \n}' },
  { label: 'Set rule', insert: '#set text(size: 11pt)' },
  { label: 'Show rule', insert: '#show heading: it => {\n  it\n}' },
  { label: 'Package import', insert: '#import "@preview/NAME:0.1.0": *' },
  { label: 'Label + reference', insert: '<label>\n// later: @label' },
  { label: 'Comment', insert: '// ' },
  { label: 'Line of dots (fill)', insert: '#box(width: 100%)[#line(length: 100%)]' },
]

const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: 'Ctrl-S', what: 'Snapshot + save (unless disabled in settings)' },
  { keys: 'Ctrl-F', what: 'Find (find & replace panel)' },
  { keys: 'Ctrl-A', what: 'Select all' },
  { keys: 'Ctrl-Z / Ctrl-Y', what: 'Undo / redo' },
  { keys: 'Ctrl-Space', what: 'Snippets palette' },
  { keys: 'Ctrl-+ / Ctrl--', what: 'Zoom preview in / out' },
  { keys: 'Ctrl-0', what: 'Reset preview zoom' },
  { keys: 'Ctrl-N', what: 'New file' },
  { keys: 'Esc', what: 'Close dialog / popover' },
  { keys: 'Tab / Shift-Tab', what: 'Indent / outdent selection' },
  { keys: 'Vim mode', what: 'Enabled in settings (hjkl, :, etc.)' },
]

export function SnippetsPalette({ open, onClose, onInsert }: {
  open: boolean
  onClose: () => void
  onInsert: (text: string) => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TYPST_SNIPPETS
    return TYPST_SNIPPETS.filter((s) => s.label.toLowerCase().includes(q) || s.insert.toLowerCase().includes(q))
  }, [query])

  useEffect(() => setIndex(0), [query])

  if (!open) return null

  const commit = (i: number) => {
    const s = matches[i]
    if (!s) return
    onInsert(s.insert)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-md rounded-xl border border-line bg-panel shadow-[0_16px_48px_-12px_rgba(0,0,0,.55)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Snippets"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); commit(index) }
        }}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Zap size={14} className="text-fg-3 shrink-0" />
          <input
            ref={inputRef}
            className="w-full bg-transparent py-2.5 text-sm text-fg outline-none placeholder:text-fg-3"
            placeholder="Search snippets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search snippets"
          />
        </div>
        <div ref={listRef} className="max-h-72 overflow-auto py-1">
          {matches.length === 0 && <p className="px-3 py-4 text-xs text-fg-3">No snippets match.</p>}
          {matches.map((s, i) => (
            <button
              key={s.label}
              className={`block w-full text-left px-3 py-1.5 text-sm ${i === index ? 'bg-raised text-fg' : 'text-fg-2'}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => commit(i)}
            >
              <span className="font-medium">{s.label}</span>
              <span className="ml-2 text-[11px] text-fg-3 font-mono truncate">{s.insert.replace(/\n/g, '⏎ ').slice(0, 42)}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-line px-3 py-1.5 text-[11px] text-fg-3">↑↓ to browse · Enter to insert · Esc to close</div>
      </div>
    </div>
  )
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-xl border border-line bg-panel p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,.55)]" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fg">Keyboard shortcuts</h2>
          <button className="text-fg-2 hover:text-fg text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="divide-y divide-line">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
              <span className="text-fg-2">{s.what}</span>
              <kbd className="shrink-0 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fg">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
