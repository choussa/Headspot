import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface BaseProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onCancel: () => void
}

interface PromptProps extends BaseProps {
  initialValue?: string
  placeholder?: string
  /** Shows the value as selectable text with a Done action instead of editing it. */
  readOnly?: boolean
  onConfirm: (value: string) => void
}

function Shell({
  open, title, description, destructive, onCancel, children,
}: Omit<BaseProps, 'confirmLabel'> & { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusTarget =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('input, button')
    focusTarget?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-sm rounded-xl border border-line bg-panel p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,.55)]"
      >
        <div className="flex gap-3">
          {destructive && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/12 text-danger">
              <AlertTriangle size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-fg">{title}</h2>
            {description && (
              <p id={descId} className="mt-1 text-[13px] leading-relaxed text-fg-2">
                {description}
              </p>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

function Actions({
  confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel, disabled,
}: {
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line bg-raised px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-line"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white transition-colors disabled:opacity-45 ${
          destructive
            ? 'bg-danger-fill hover:brightness-110'
            : 'bg-accent-fill hover:brightness-110'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}

export function ConfirmDialog(props: BaseProps & { onConfirm: () => void }) {
  const { open, title, description, confirmLabel, cancelLabel, destructive, onConfirm, onCancel } = props
  return (
    <Shell
      open={open}
      title={title}
      description={description}
      destructive={destructive}
      onCancel={onCancel}
    >
      <Actions
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </Shell>
  )
}

export function PromptDialog({
  open, title, description, confirmLabel, cancelLabel, placeholder, initialValue = '',
  destructive, readOnly, onConfirm, onCancel,
}: PromptProps) {
  const [value, setValue] = useState(initialValue)
  const [wasOpen, setWasOpen] = useState(open)
  const inputId = useId()

  // Reseed the field on each open, without a setState-in-effect round trip.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(initialValue)
  }

  useEffect(() => {
    if (open && readOnly) {
      window.setTimeout(() => {
        const el = document.getElementById(inputId)
        if (el instanceof HTMLInputElement) el.select()
      }, 0)
    }
  }, [open, readOnly, inputId])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <Shell
      open={open}
      title={title}
      description={description}
      destructive={destructive}
      onCancel={onCancel}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (readOnly) onCancel()
          else submit()
        }}
      >
        <label htmlFor={inputId} className="sr-only">{title}</label>
        <input
          id={inputId}
          data-autofocus
          readOnly={readOnly}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => { if (readOnly) e.currentTarget.select() }}
          className="mt-4 w-full rounded-lg border border-control bg-raised px-3 py-2 text-sm text-fg placeholder:text-fg-3"
        />
        <Actions
          confirmLabel={readOnly ? 'Done' : confirmLabel}
          cancelLabel={readOnly ? undefined : cancelLabel}
          destructive={destructive}
          onConfirm={readOnly ? onCancel : submit}
          onCancel={onCancel}
          disabled={!readOnly && !value.trim()}
        />
      </form>
    </Shell>
  )
}
