import { useMemo, useState } from 'react'
import { listSnapshots, diffLines, type Snapshot } from '../storage/history'

interface Props {
  projectId: string
  currentMainText: string
  onRestore: (snapshot: Snapshot) => void
}

export function HistoryPanel({ projectId, currentMainText, onRestore }: Props) {
  const [tick, setTick] = useState(0)
  const snaps = useMemo(() => listSnapshots(projectId), [projectId, tick])
  const [selected, setSelected] = useState(0)
  const snap = snaps[selected]
  const snapMain = snap?.files.find((f) => f.path === '/main.typ')?.text ?? ''
  const diff = useMemo(() => diffLines(snapMain, currentMainText), [snapMain, currentMainText])

  return (
    <div className="file-panel">
      <div className="h-full flex flex-col text-sm" style={{ background: 'var(--panel-bg)' }}>
        <div className="file-panel-header">History</div>
        <div className="flex-1 overflow-auto p-2">
          {snaps.length === 0 && <p className="text-xs text-fg-3 p-1">No snapshots yet. They are taken every 10 minutes and on Ctrl+S.</p>}
          {snaps.map((s, i) => (
            <button key={s.ts} className={`file-row w-full text-left text-xs py-1 ${i === selected ? 'file-row-active' : ''}`} onClick={() => setSelected(i)}>
              {new Date(s.ts).toLocaleString()}
            </button>
          ))}
          {snap && (
            <button
              className="mt-2 rounded border border-line px-2 py-1 text-xs text-fg-2 hover:text-fg"
              onClick={() => { onRestore(snap); setTick((t) => t + 1) }}
            >
              Restore this version
            </button>
          )}
          <h4 className="mt-3 text-[11px] uppercase tracking-wide text-fg-3">Changes vs current</h4>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-4">
            {diff.map((d, i) => (
              <div key={i} className={d.type === 'add' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : d.type === 'del' ? 'bg-red-500/10 text-red-500 line-through' : 'text-fg-3'}>
                {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}{d.text}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}
