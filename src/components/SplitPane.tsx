import { useRef, useState, type ReactNode } from 'react'

export function SplitPane({ left, right, vertical = true }: { left: ReactNode; right: ReactNode; vertical?: boolean }) {
  const [pct, setPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  const clamp = (value: number) => Math.min(80, Math.max(20, value))

  const onPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const next = vertical
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100
      setPct(clamp(next))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  // Arrow keys mirror the drag so the divider is not mouse-only.
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const decreaseKey = vertical ? 'ArrowLeft' : 'ArrowUp'
    const increaseKey = vertical ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== decreaseKey && e.key !== increaseKey && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    if (e.key === 'Home') setPct(20)
    else if (e.key === 'End') setPct(80)
    else setPct((p) => clamp(p + (e.key === increaseKey ? 2 : -2)))
  }

  const isRow = !vertical
  const hasRight = right !== null && right !== undefined && right !== false

  return (
    <div ref={containerRef} className={`flex-1 min-w-0 min-h-0 flex ${vertical ? 'flex-col md:flex-row' : 'flex-col'}`}>
      <div style={{ flex: hasRight ? `${pct} 1 0%` : '1 1 0%' }} className="min-w-0 min-h-0 overflow-hidden">{left}</div>
      {hasRight && (
        <div
          className="split-handle"
          role="separator"
          tabIndex={0}
          aria-orientation={isRow ? 'horizontal' : 'vertical'}
          aria-label="Resize editor and preview"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={20}
          aria-valuemax={80}
          onPointerDown={onPointerDown}
          onKeyDown={onHandleKeyDown}
        />
      )}
      {hasRight && <div style={{ flex: `${100 - pct} 1 0%` }} className="min-w-0 min-h-0 overflow-hidden">{right}</div>}
    </div>
  )
}
