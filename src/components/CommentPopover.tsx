import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { relTime, type ProjectComment, type CommentReply } from '../storage/comments'

export interface PopoverAnchor {
  x: number
  y: number
  above: boolean
}

interface Props {
  comment: ProjectComment | null
  line: number
  anchor: PopoverAnchor
  me: string
  onClose: () => void
  onCreate: (text: string) => void
  onChange: (comment: ProjectComment) => void
  onDelete: (id: string) => void
  onJump: (from: number) => void
}

function ReplyItem({ reply, onSave, onDelete }: {
  reply: CommentReply
  onSave: (text: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reply.text)
  if (editing) {
    return (
      <div className="px-3 py-2 border-t border-line/60">
        <textarea
          className="w-full bg-app border border-line rounded px-2 py-1 text-xs text-fg outline-none focus:border-accent-fill resize-none"
          rows={2}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex justify-end gap-1 mt-1">
          <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Save reply" aria-label="Save reply" onClick={() => { const t = draft.trim(); if (t) onSave(t); setEditing(false) }}>
            <Check size={12} />
          </button>
          <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Cancel" aria-label="Cancel" onClick={() => { setDraft(reply.text); setEditing(false) }}>
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="group/reply px-3 py-1.5 border-t border-line/60 flex justify-between gap-2">
      <div className="min-w-0">
        <span className="font-semibold text-brand">{reply.author}</span>
        <span className="text-fg-2 font-medium ml-2">{relTime(reply.ts)}</span>
        <p className="text-fg whitespace-pre-wrap mt-0.5">{reply.text}</p>
      </div>
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover/reply:opacity-100 group-focus-within/reply:opacity-100 transition-opacity">
        <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Edit reply" aria-label="Edit reply" onClick={() => setEditing(true)}>
          <Pencil size={11} />
        </button>
        <button className="p-1 text-fg-2 hover:text-danger rounded hover:bg-raised" title="Delete reply" aria-label="Delete reply" onClick={onDelete}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

export function CommentPopover({ comment, line, anchor, me, onClose, onCreate, onChange, onDelete, onJump }: Props) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const isThread = comment !== null

  const submitReply = () => {
    if (!comment || !draft.trim()) return
    const reply: CommentReply = { id: crypto.randomUUID(), author: me, text: draft.trim(), ts: Date.now() }
    onChange({ ...comment, replies: [...comment.replies, reply] })
    setDraft('')
  }

  const saveEdit = () => {
    if (!comment || !editing || !editing.text.trim()) return
    onChange({ ...comment, text: editing.text.trim() })
    setEditing(null)
  }

  return (
    <div
      className={`comment-popover bg-panel border border-brand rounded-md shadow-lg w-[300px] flex flex-col text-sm ${anchor.above ? 'comment-popover--above' : ''}`}
      style={{ position: 'fixed', left: anchor.x, top: anchor.y, transform: anchor.above ? 'translateY(-100%)' : undefined }}
      role="dialog"
      aria-label={isThread ? 'Comment thread' : 'New comment'}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      {isThread && comment ? (
        <div className="flex flex-col min-h-0">
          <div className="flex justify-between items-center px-3 pt-3 pb-1 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-brand">{comment.author}</span>
              <span className="text-fg-2 font-medium">{relTime(comment.ts)}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised"
                title="Edit comment"
                aria-label="Edit comment"
                onClick={() => setEditing({ id: comment.id, text: comment.text })}
              >
                <Pencil size={11} />
              </button>
              <button
                className="p-1 text-fg-2 hover:text-danger rounded hover:bg-raised"
                title="Delete comment"
                aria-label="Delete comment"
                onClick={() => { onDelete(comment.id); onClose() }}
              >
                <Trash2 size={11} />
              </button>
              <button
                className="text-fg-2 hover:text-fg rounded px-1 flex items-center gap-1 ml-1"
                title={`Go to line ${line}`}
                aria-label={`Go to line ${line}`}
                onClick={() => { onJump(comment.from); onClose() }}
              >
                Ln {line}
              </button>
            </div>
          </div>

          {editing?.id === comment.id ? (
            <div className="px-3 pb-2">
              <textarea
                className="w-full bg-app border border-line rounded px-2 py-1 text-xs text-fg outline-none focus:border-accent-fill resize-none"
                rows={3}
                autoFocus
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              />
              <div className="flex justify-end gap-1 mt-1">
                <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Save" aria-label="Save" onClick={saveEdit}>
                  <Check size={12} />
                </button>
                <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Cancel" aria-label="Cancel" onClick={() => setEditing(null)}>
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <p className="px-3 pb-2 text-fg text-xs leading-relaxed whitespace-pre-wrap">{comment.text}</p>
          )}

          {comment.replies.map((r) => (
            <ReplyItem
              key={r.id}
              reply={r}
              onSave={(text) => onChange({ ...comment, replies: comment.replies.map((x) => (x.id === r.id ? { ...x, text } : x)) })}
              onDelete={() => onChange({ ...comment, replies: comment.replies.filter((x) => x.id !== r.id) })}
            />
          ))}

          <div className="border-t border-line p-2 flex items-center gap-2 bg-panel rounded-b-md">
            <input
              className="flex-1 bg-transparent border-none outline-none text-sm text-fg placeholder:text-fg-2"
              placeholder="Reply…"
              aria-label="Reply to comment"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitReply() } }}
            />
            <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Send reply" aria-label="Send reply" onClick={submitReply}>
              <Check size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex justify-between items-center px-3 pt-3 pb-1 text-xs">
            <span className="font-semibold text-brand">New comment</span>
            <div className="flex items-center gap-0.5">
              <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Close" aria-label="Close" onClick={onClose}>
                <X size={11} />
              </button>
              <span className="text-fg-2 font-medium ml-1">Ln {line}</span>
            </div>
          </div>
          <textarea
            className="mx-3 mb-1 bg-app border border-line rounded px-2 py-1.5 text-xs text-fg outline-none focus:border-accent-fill resize-none"
            rows={3}
            autoFocus
            placeholder="Leave a comment on the selected text…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (draft.trim()) onCreate(draft.trim()) } }}
          />
          <div className="border-t border-line p-2 flex items-center justify-end gap-2 bg-panel rounded-b-md">
            <button className="p-1 text-fg-2 hover:text-danger rounded hover:bg-raised" title="Discard" aria-label="Discard" onClick={onClose}>
              <Trash2 size={14} />
            </button>
            <button className="p-1 text-fg-2 hover:text-fg rounded hover:bg-raised" title="Add comment" aria-label="Add comment" onClick={() => { if (draft.trim()) onCreate(draft.trim()) }}>
              <Check size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
