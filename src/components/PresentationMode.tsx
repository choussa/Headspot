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

  useEffect(() => {
    let alive = true
    renderPage(index).then((s) => { if (alive) setSvg(s ?? null) })
    return () => { alive = false }
  }, [index, renderPage])

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
      {svg ? (
        <div
          className="max-h-[85vh] max-w-[90vw] [&>svg]:h-[85vh] [&>svg]:w-auto [&>svg]:max-w-[90vw]"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-white/50 text-sm">Rendering…</p>
      )}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-2xl px-3"
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.max(0, i - 1)) }}
        aria-label="Previous page"
      >
        ‹
      </button>
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-2xl px-3"
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.min(pages.length - 1, i + 1)) }}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  )
}
