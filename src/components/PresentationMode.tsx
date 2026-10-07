import { useEffect, useState } from 'react'
import type { PageInfo } from '@vedivad/typst-web-service'

interface Props {
  pages: PageInfo[]
  renderPage: (index: number) => Promise<string | undefined>
  onExit: () => void
}

export function PresentationMode({ pages, renderPage, onExit }: Props) {
  const [index, setIndex] = useState(0)
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setFailed(false)
    setSvg(null)
    renderPage(index)
      .then((s) => { if (alive) setSvg(s ?? null) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [index, renderPage, attempt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') setIndex((i) => Math.min(pages.length - 1, i + 1))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(pages.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length, onExit])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
    >
      <button
        className="absolute top-4 right-4 text-white/60 hover:text-white text-sm"
        onClick={(e) => { e.stopPropagation(); onExit() }}
        aria-label="Exit presentation"
      >
        Esc
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
        {pages.length === 0 ? 'No pages' : `${index + 1} / ${pages.length}`}
      </div>
      {failed ? (
        <div className="text-center text-sm text-white/70">
          <p>This page could not be rendered.</p>
          <button
            className="mt-3 rounded border border-white/30 px-3 py-1.5 text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            onClick={(e) => { e.stopPropagation(); setAttempt((a) => a + 1) }}
          >
            Try again
          </button>
        </div>
      ) : svg ? (
        <div
          className="max-h-[85vh] max-w-[90vw] [&>svg]:h-[85vh] [&>svg]:w-auto [&>svg]:max-w-[90vw]"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-white/50 text-sm" role="status" aria-live="polite">Rendering…</p>
      )}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-3 text-3xl leading-none text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30"
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.max(0, i - 1)) }}
        aria-label="Previous page"
        disabled={index === 0}
      >
        ‹
      </button>
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-3 text-3xl leading-none text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30"
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.min(pages.length - 1, i + 1)) }}
        aria-label="Next page"
        disabled={index >= pages.length - 1}
      >
        ›
      </button>
      <p className="absolute bottom-4 right-4 hidden text-[11px] text-white/40 sm:block">Esc to exit · ←/→ to navigate</p>
    </div>
  )
}
