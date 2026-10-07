import { useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'

interface Props {
  source: string
  onJump: (line: number) => void
  bookmarks?: number[]
  onToggleBookmark?: (line: number) => void
}

export function OutlinePanel({ source, onJump, bookmarks = [], onToggleBookmark }: Props) {
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)
  const headings = useMemo(() => {
    const lines = source.split('\n')
    const out: { level: number; text: string; line: number }[] = []
    lines.forEach((line, i) => {
      const m = /^(=+)\s+(.+)$/.exec(line)
      if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 })
    })
    return out
  }, [source])

  const marked = new Set(bookmarks)
  const visible = showBookmarksOnly ? headings.filter((h) => marked.has(h.line)) : headings

  return (
    <div className="file-panel">
      <div className="h-full flex flex-col text-sm bg-panel">
        <div className="file-panel-header">
          Outline
          <button
            className={`ml-auto text-[10px] uppercase tracking-wide px-1 rounded ${showBookmarksOnly ? 'text-accent' : 'text-fg-3 hover:text-fg'}`}
            title="Show only bookmarked headings"
            aria-pressed={showBookmarksOnly}
            onClick={() => setShowBookmarksOnly((v) => !v)}
          >
            Bookmarked ({bookmarks.length})
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {visible.length === 0 && (
            <p className="text-xs text-fg-3 p-1">
              {showBookmarksOnly ? 'No bookmarked headings yet.' : 'No headings yet.'}
            </p>
          )}
          {visible.map((h) => (
            <div key={h.line} className="group flex items-center">
              <button
                className="file-row flex-1 text-left text-xs py-1 truncate"
                style={{ paddingLeft: (h.level - 1) * 12 }}
                onClick={() => onJump(h.line)}
              >
                {h.text}
              </button>
              {onToggleBookmark && (
                <button
                  className={`rounded px-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 ${marked.has(h.line) ? 'text-accent opacity-100' : 'text-fg-3 hover:text-fg'}`}
                  title={marked.has(h.line) ? 'Remove bookmark' : 'Bookmark this heading'}
                  aria-label={marked.has(h.line) ? 'Remove bookmark' : 'Bookmark this heading'}
                  aria-pressed={marked.has(h.line)}
                  onClick={() => onToggleBookmark(h.line)}
                >
                  {marked.has(h.line) ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
