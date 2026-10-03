import { useEffect, useRef } from 'react'

interface Props {
  page: number
  width: number
  height: number
  svg: string | undefined
  observer: IntersectionObserver | null
}

export function PagePlaceholder({ page, width, height, svg, observer }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !observer) return
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [observer])

  return (
    <div
      ref={ref}
      data-page={page}
      className="mb-4 mx-auto bg-white shadow"
      style={{ width: '100%', maxWidth: width, aspectRatio: `${width} / ${height}` }}
    >
      {svg ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
    </div>
  )
}
