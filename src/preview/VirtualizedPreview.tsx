import { useEffect, useRef, useState } from 'react'
import { PagePlaceholder } from './PagePlaceholder'

export interface PageData {
  page: number
  width: number
  height: number
  svg: string | undefined
}

export function VirtualizedPreview({ pages }: { pages: PageData[] }) {
  const [visible, setVisible] = useState<Set<number>>(new Set())
  const [observer, setObserver] = useState<IntersectionObserver | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev)
          for (const e of entries) {
            const page = Number((e.target as HTMLElement).dataset.page)
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

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-neutral-200 p-4">
      {pages.length === 0 && <p className="text-neutral-500 text-sm text-center mt-8">No pages yet — compile to preview.</p>}
      {pages.map((p) => (
        <PagePlaceholder
          key={p.page}
          page={p.page}
          width={p.width}
          height={p.height}
          svg={visible.has(p.page) ? p.svg : undefined}
          observer={observer}
        />
      ))}
    </div>
  )
}
