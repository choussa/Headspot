import { useEffect, useRef, useState, type ReactNode } from 'react'

/** True while the viewport is at the `md` breakpoint or wider. */
function useIsWide() {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

export function SplitPane({ left, right, vertical = true }: { left: ReactNode; right: ReactNode; vertical?: boolean }) {
  const [pct, setPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isWide = useIsWide()

  const clamp = (value: number) => Math.min(80, Math.max(20, value))

  // Below md the two panes stack, so the divider runs horizontally there.
  const sideBySide = vertical && isWide
  const stacked = !sideBySide

  const onPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const next = sideBySide
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
    const decreaseKey = sideBySide ? 'ArrowLeft' : 'ArrowUp'
    const increaseKey = sideBySide ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== decreaseKey && e.key !== increaseKey && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    if (e.key === 'Home') setPct(20)
    else if (e.key === 'End') setPct(80)
    else setPct((p) => clamp(p + (e.key === increaseKey ? 2 : -2)))
  }

  const hasRight = right !== null && right !== undefined && right !== false

  return (
    <div ref={containerRef} className={`flex-1 min-w-0 min-h-0 flex ${sideBySide ? 'flex-row' : 'flex-col'}`}>
      <div style={{ flex: hasRight ? `${pct} 1 0%` : '1 1 0%' }} className="min-w-0 min-h-0 overflow-hidden">{left}</div>
      {hasRight && (
        <div
          className={`split-handle ${stacked ? 'split-handle-horizontal' : 'split-handle-vertical'}`}
          role="separator"
          tabIndex={0}
          aria-orientation={stacked ? 'horizontal' : 'vertical'}
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
