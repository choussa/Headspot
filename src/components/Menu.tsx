import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export interface MenuItem {
  label: string
  checked?: boolean
  disabled?: boolean
  pro?: boolean
  shortcut?: string
  onSelect?: () => void
  submenu?: MenuItem[]
}

export function MenuRow({ item, close }: { item: MenuItem; close: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div
      ref={ref}
      className={`menu-row${item.disabled ? ' menu-row-disabled' : ''}${open ? ' menu-row-open' : ''}`}
      role="menuitem"
      aria-disabled={item.disabled}
      onMouseEnter={() => item.submenu && setOpen(true)}
      onClick={() => {
        if (item.disabled) return
        if (item.submenu) {
          setOpen((v) => !v)
          return
        }
        item.onSelect?.()
        close()
      }}
    >
      <span className="menu-check">{item.checked ? '✓' : ''}</span>
      <span className="menu-label">{item.label}</span>
      {item.pro && <span className="pro-badge">PRO</span>}
      {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
      {item.submenu && <ChevronRight size={13} className="menu-chevron" />}
      {item.submenu && open && (
        <div className="menu-submenu" role="menu">
          {item.submenu.map((sub) => (
            <MenuRow key={sub.label} item={sub} close={close} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Menu({ items, close, children }: { items: MenuItem[]; close: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [close])
  return (
    <div ref={ref} className="menu-root" role="menu">
      {children}
      {items.map((item) => (
        <MenuRow key={item.label} item={item} close={close} />
      ))}
    </div>
  )
}
