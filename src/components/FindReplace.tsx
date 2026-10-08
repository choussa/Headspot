import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

interface Props {
  viewRef: MutableRefObject<EditorView | null>
  open: boolean
  onClose: () => void
}

const iconBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-2 hover:bg-raised hover:text-fg focus-visible:outline-2'

export function FindReplace({ viewRef, open, onClose }: Props) {
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [count, setCount] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      findRef.current?.focus()
      findRef.current?.select()
    }
  }, [open])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({ search: open ? find : '', replace, literal: true, caseSensitive: false }),
      ),
    })
  }, [find, replace, open, viewRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Count matches from the editor document (an external system) — done in an
  // effect because refs must not be read during render.
  useEffect(() => {
    const view = viewRef.current
    if (!open || !find || !view) {
      setCount(0)
      return
    }
    const haystack = view.state.doc.toString().toLowerCase()
    const needle = find.toLowerCase()
    let n = 0
    let i = haystack.indexOf(needle)
    while (i !== -1) {
      n += 1
      i = haystack.indexOf(needle, i + needle.length)
    }
    setCount(n)
  }, [find, open, viewRef])

  if (!open) return null

  const run = (fn: (v: EditorView) => boolean) => () => {
    const view = viewRef.current
    if (!view) return
    fn(view)
    view.focus()
  }

  return (
    <div
      role="dialog"
      aria-label="Find and replace"
      className="absolute right-2 top-2 z-30 w-[340px] max-w-[calc(100%-1rem)] rounded-lg border border-line bg-panel shadow-[0_12px_32px_-12px_rgba(0,0,0,.6)]"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-2 py-2">
        <input
          ref={findRef}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              run(e.shiftKey ? findPrevious : findNext)()
            }
          }}
          placeholder="Find"
          aria-label="Find"
          className="min-w-0 flex-1 rounded border border-control bg-raised px-2 py-1 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-accent"
        />
        <span
          aria-live="polite"
          className="tnum w-14 shrink-0 text-right text-xs text-fg-3"
        >
          {find ? `${count} result${count === 1 ? '' : 's'}` : ''}
        </span>
        <button type="button" aria-label="Previous match" title="Previous (Shift+Enter)" className={iconBtn} onClick={run(findPrevious)}>
          <ChevronUp size={15} />
        </button>
        <button type="button" aria-label="Next match" title="Next (Enter)" className={iconBtn} onClick={run(findNext)}>
          <ChevronDown size={15} />
        </button>
        <button type="button" aria-label="Close find and replace" title="Close (Esc)" className={iconBtn} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-2">
        <input
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              run(replaceNext)()
            }
          }}
          placeholder="Replace"
          aria-label="Replace with"
          className="min-w-0 flex-1 rounded border border-control bg-raised px-2 py-1 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-accent"
        />
        <button
          type="button"
          disabled={!find}
          onClick={run(replaceNext)}
          className="shrink-0 rounded border border-line bg-raised px-2 py-1 text-xs font-medium text-fg transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-45"
        >
          Replace
        </button>
        <button
          type="button"
          disabled={!find}
          onClick={run(replaceAll)}
          className="shrink-0 rounded bg-accent-fill px-2 py-1 text-xs font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Replace all
        </button>
      </div>
    </div>
  )
}
