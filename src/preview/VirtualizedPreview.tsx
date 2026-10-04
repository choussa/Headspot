import { useEffect, useRef, useState } from 'react'
import type { PageInfo } from '@vedivad/typst-web-service'
import { PagePlaceholder } from './PagePlaceholder'

interface Props {
  pages: PageInfo[]
  compileSeq: number
  renderPage: (index: number) => Promise<string | undefined>
  zoom?: number
  onZoomChange?: (zoom: number) => void
}

export function VirtualizedPreview({ pages, compileSeq, renderPage, zoom = 100, onZoomChange }: Props) {
  const [visible, setVisible] = useState<Set<number>>(new Set())
  const [observer, setObserver] = useState<IntersectionObserver | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pinchDistance = useRef<number | null>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev)
          for (const e of entries) {
            const page = Number((e.target as HTMLElement).dataset.page) - 1
            if (e.isIntersecting) next.add(page)
            else next.delete(page)
          }
          return next
        })
      },
      { root: containerRef.current, rootMargin: '200px 0px' },
    )
    setObserver(obs)
    return () => obs.disconnect()
  }, [])

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const onZoomChangeRef = useRef(onZoomChange)
  onZoomChangeRef.current = onZoomChange

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    
    const onNativeTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) event.preventDefault()
    }
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false })
    return () => {
      
      el.removeEventListener('touchmove', onNativeTouchMove)
    }
  }, [])

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return
    const [first, second] = Array.from(event.touches)
    pinchDistance.current = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
  }

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || pinchDistance.current === null || !onZoomChange) return
    const [first, second] = Array.from(event.touches)
    const nextDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    const delta = nextDistance - pinchDistance.current
    if (Math.abs(delta) < 8) return
    event.preventDefault()
    pinchDistance.current = nextDistance
    onZoomChange(Math.min(125, Math.max(50, zoom + (delta > 0 ? 5 : -5))))
  }

  const onTouchEnd = () => {
    pinchDistance.current = null
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="preview-scroll h-full overflow-auto bg-neutral-200 p-4"
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div className="preview-page-layer" style={{ zoom: zoom / 100 }}>
      {pages.length === 0 && <p className="text-neutral-500 text-sm text-center mt-8">No pages yet — compile to preview.</p>}
      {pages.map((p, i) => (
        <PagePlaceholder
          key={i}
          index={i}
          width={p.width}
          height={p.height}
          visible={visible.has(i)}
          compileSeq={compileSeq}
          renderPage={renderPage}
          observer={observer}
        />
      ))}
      </div>
    </div>
  )
}
