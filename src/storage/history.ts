import type { ProjectFile } from '../state/workspace'

export interface Snapshot {
  ts: number
  files: ProjectFile[]
}

const KEY = (id: string) => `typst:history:${id}`
const MAX = 20

/** Cheap fingerprint of all source text — used to skip snapshots that changed nothing. */
function fingerprint(files: ProjectFile[]): string {
  return files.map((f) => (f.kind === 'source' ? `${f.path}\u0000${f.text ?? ''}` : `${f.path}\u0000A`)).join('\n')
}

export function listSnapshots(projectId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(KEY(projectId))
    if (!raw) return []
    const snaps = JSON.parse(raw) as Snapshot[]
    return snaps.map((s) => ({
      ts: s.ts,
      files: s.files.map((f) => ({
        ...f,
        data: f.data ? new Uint8Array(Object.values(f.data) as number[]) : undefined,
      })),
    }))
  } catch {
    return []
  }
}

export function takeSnapshot(projectId: string, files: ProjectFile[]): void {
  try {
    const snaps = listSnapshots(projectId)
    const fp = fingerprint(files)
    const prevFp = snaps[0] ? fingerprint(snaps[0].files) : null
    if (prevFp === fp) return // nothing changed since the last snapshot
    // Store source text only; asset bytes are restored from the live record on restore.
    const lean = files.map((f) => (f.kind === 'asset' ? { path: f.path, kind: f.kind } : f))
    snaps.unshift({ ts: Date.now(), files: JSON.parse(JSON.stringify(lean)) })
    localStorage.setItem(KEY(projectId), JSON.stringify(snaps.slice(0, MAX)))
  } catch {
    // storage full — drop oldest
    try {
      const snaps = listSnapshots(projectId).slice(0, MAX - 5)
      const lean = files.map((f) => (f.kind === 'asset' ? { path: f.path, kind: f.kind } : f))
      snaps.unshift({ ts: Date.now(), files: JSON.parse(JSON.stringify(lean)) })
      localStorage.setItem(KEY(projectId), JSON.stringify(snaps))
    } catch { /* ignore */ }
  }
}

export interface DiffLine { type: 'same' | 'add' | 'del'; text: string }

export function diffLines(a: string, b: string): DiffLine[] {
  const la = a.split('\n')
  const lb = b.split('\n')
  const n = la.length
  const m = lb.length
  if (n * m > 200_000) {
    return [...la.map((t) => ({ type: 'del' as const, text: t })), ...lb.map((t) => ({ type: 'add' as const, text: t }))]
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = la[i - 1] === lb[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const out: DiffLine[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (la[i - 1] === lb[j - 1]) { out.unshift({ type: 'same', text: la[i - 1] }); i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { out.unshift({ type: 'del', text: la[i - 1] }); i-- }
    else { out.unshift({ type: 'add', text: lb[j - 1] }); j-- }
  }
  while (i > 0) out.unshift({ type: 'del', text: la[--i] })
  while (j > 0) out.unshift({ type: 'add', text: lb[--j] })
  return out
}
