import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { PreviewNavigator, type TypstProject } from '@vedivad/typst-web-service'
import type { PageInfo } from '@vedivad/typst-web-service'
import { PagePlaceholder } from './PagePlaceholder'

interface Props {
  pages: PageInfo[]
  compileSeq: number
  renderPage: (index: number) => Promise<string | undefined>
  zoom?: number
  onZoomChange?: (zoom: number) => void
  engine?: TypstProject | null
  navRef?: MutableRefObject<PreviewNavigator | null>
  onSourceJump?: (file: string, line: number, column: number) => void
}

export function VirtualizedPreview({ pages, compileSeq, renderPage, zoom = 100, onZoomChange, engine, navRef, onSourceJump }: Props) {
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

  const onSourceJumpRef = useRef(onSourceJump)
  useEffect(() => {
    onSourceJumpRef.current = onSourceJump
  })

  useEffect(() => {
    const scroller = containerRef.current
    if (!scroller || !engine || !navRef) return
    const nav = PreviewNavigator.create({
      project: () => engine,
      scroller,
      pages: () => Array.from(scroller.querySelectorAll('[data-page]')),
      onSource: (file, line, column) => onSourceJumpRef.current?.(file, line, column),
    })
    navRef.current = nav
    return () => {
      nav.dispose()
      navRef.current = null
    }
  }, [engine, navRef])

  const clampZoom = (value: number) => Math.min(500, Math.max(25, value))
  const zoomRef = useRef(zoom)
  const onZoomChangeRef = useRef(onZoomChange)
  useEffect(() => {
    zoomRef.current = zoom
    onZoomChangeRef.current = onZoomChange
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onNativeWheel = (event: WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || !onZoomChangeRef.current) return
      event.preventDefault()
      onZoomChangeRef.current(clampZoom(zoomRef.current + (event.deltaY > 0 ? -5 : 5)))
    }
    const onNativeTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) event.preventDefault()
    }
    el.addEventListener('wheel', onNativeWheel, { passive: false })
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', onNativeWheel)
      el.removeEventListener('touchmove', onNativeTouchMove)
    }
  }, [])

  const touchDistance = (event: React.TouchEvent<HTMLDivElement>) => {
    const [a, b] = Array.from(event.touches)
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
  }

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) pinchDistance.current = touchDistance(event)
  }

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || pinchDistance.current === null || !onZoomChangeRef.current) return
    const next = touchDistance(event)
    const delta = next - pinchDistance.current
    if (Math.abs(delta) < 8) return
    pinchDistance.current = next
    onZoomChangeRef.current(clampZoom(zoomRef.current + (delta > 0 ? 5 : -5)))
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
      className="preview-scroll h-full overflow-auto bg-preview p-4"
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div className="preview-page-layer">
      {pages.length === 0 && <p className="mt-8 text-center text-sm text-fg-2">No pages yet — compile to preview.</p>}
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
          zoom={zoom}
        />
      ))}
      </div>
    </div>
  )
}
