import { useRef, useState, type ReactNode } from 'react'

export function SplitPane({ left, right, vertical = true }: { left: ReactNode; right: ReactNode; vertical?: boolean }) {
  const [pct, setPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const horizontal = vertical
      const next = horizontal
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100
      setPct(Math.min(80, Math.max(20, next)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  return (
    <div ref={containerRef} className={`flex-1 min-h-0 flex ${vertical ? 'flex-col md:flex-row' : 'flex-col'}`}>
      <div style={{ flex: pct }} className="min-w-0 min-h-0 overflow-hidden">{left}</div>
      <div
        className="h-1 md:h-auto md:w-1 bg-neutral-300 hover:bg-blue-500 cursor-row-resize md:cursor-col-resize"
        onPointerDown={onPointerDown}
      />
      <div style={{ flex: 100 - pct }} className="min-w-0 min-h-0 overflow-hidden">{right}</div>
    </div>
  )
}
