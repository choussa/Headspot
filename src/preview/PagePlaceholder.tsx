import { memo, useEffect, useRef, useState } from 'react'

interface Props {
  index: number
  width: number
  height: number
  visible: boolean
  compileSeq: number
  renderPage: (index: number) => Promise<string | undefined>
  observer: IntersectionObserver | null
  zoom?: number
}

export const PagePlaceholder = memo(function PagePlaceholder({ index, width, height, visible, compileSeq, renderPage, observer, zoom = 100 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !observer) return
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [observer])

  useEffect(() => {
    if (!visible) return
    let alive = true
    renderPage(index)
      .then((s) => { if (alive) setSvg(s ?? null) })
      .catch(() => { if (alive) setSvg(null) })
    return () => { alive = false }
  }, [visible, index, compileSeq, renderPage])

  return (
    <div
      ref={ref}
      data-page={index + 1}
      role="img"
      aria-label={`Page ${index + 1}`}
      aria-busy={!svg}
      className="preview-page mx-auto bg-paper"
      style={{ width: width * zoom / 100, maxWidth: width * zoom / 100, aspectRatio: `${width} / ${height}` }}
    >
      {svg ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
    </div>
  )
})
