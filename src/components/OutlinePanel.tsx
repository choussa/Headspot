interface Props {
  source: string
  onJump: (line: number) => void
}

export function OutlinePanel({ source, onJump }: Props) {
  const lines = source.split('\n')
  const headings: { level: number; text: string; line: number }[] = []
  lines.forEach((line, i) => {
    const m = /^(=+)\s+(.+)$/.exec(line)
    if (m) headings.push({ level: m[1].length, text: m[2], line: i + 1 })
  })
  return (
    <div className="file-panel">
      <div className="h-full flex flex-col text-sm" style={{ background: 'var(--panel-bg)' }}>
        <div className="file-panel-header">Outline</div>
        <div className="flex-1 overflow-auto p-2">
          {headings.length === 0 && <p className="text-xs text-fg-3 p-1">No headings yet.</p>}
          {headings.map((h, i) => (
            <button
              key={i}
              className="file-row w-full text-left text-xs py-1 truncate"
              style={{ paddingLeft: (h.level - 1) * 12 }}
              onClick={() => onJump(h.line)}
            >
              {h.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
