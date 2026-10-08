import { useState } from 'react'
import type { ProjectComment } from '../storage/comments'

interface Props {
  comments: ProjectComment[]
  activePath: string
  currentSelection: string
  onAdd: (text: string) => void
  onJump: (path: string, from: number) => void
  onResolve: (id: string) => void
  onDelete: (id: string) => void
}

export function CommentsPanel({ comments, activePath, currentSelection, onAdd, onJump, onResolve, onDelete }: Props) {
  const [draft, setDraft] = useState('')
  const visible = comments.filter((c) => c.path === activePath)
  return (
    <div className="file-panel">
      <div className="h-full flex flex-col text-sm bg-panel">
        <div className="file-panel-header">Comments</div>
        <div className="flex-1 overflow-auto p-2 flex flex-col gap-2">
          {visible.length === 0 && <p className="text-xs text-fg-3 p-1">No comments on this file. Select text in the editor and add one.</p>}
          {visible.map((c) => (
            <div key={c.id} className={`rounded border border-line p-2 text-xs ${c.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fg-2">{c.author}</span>
                <span className="text-fg-3">{new Date(c.ts).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-fg whitespace-pre-wrap">{c.text}</p>
              <div className="mt-2 flex gap-2">
                <button className="text-xs text-fg-3 hover:text-fg rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" title="Jump to comment" onClick={() => onJump(c.path, c.from)}>Jump</button>
                <button className="text-xs text-fg-3 hover:text-fg rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-pressed={c.resolved} onClick={() => onResolve(c.id)}>{c.resolved ? 'Reopen' : 'Resolve'}</button>
                <button className="text-xs text-danger hover:opacity-80 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger" title="Delete comment" onClick={() => onDelete(c.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-line flex flex-col gap-2">
          {currentSelection && <p className="text-xs text-fg-3 truncate">On: “{currentSelection}”</p>}
          <textarea
            className="file-input rounded px-2 py-1 text-xs max-h-32"
            rows={2}
            aria-label="New comment"
            placeholder="Add a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="rounded border border-line px-2 py-1 text-xs text-fg-2 hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!draft.trim()}
            onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft('') } }}
          >
            Add comment
          </button>
        </div>
      </div>
    </div>
  )
}
