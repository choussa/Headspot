import { supabase } from '../lib/supabase'

export interface CommentReply {
  id: string
  author: string
  text: string
  ts: number
}

export interface ProjectComment {
  id: string
  path: string
  from: number
  to: number
  text: string
  author: string
  ts: number
  resolved: boolean
  replies: CommentReply[]
}

const KEY = (id: string) => `typst:comments:${id}`

function normalize(c: Partial<ProjectComment> & { id: string }): ProjectComment {
  return {
    id: c.id,
    path: c.path ?? '/',
    from: c.from ?? 0,
    to: c.to ?? c.from ?? 0,
    text: c.text ?? '',
    author: c.author ?? 'Unknown',
    ts: c.ts ?? Date.now(),
    resolved: c.resolved ?? false,
    replies: Array.isArray(c.replies) ? c.replies : [],
  }
}

export function listComments(projectId: string): ProjectComment[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY(projectId)) ?? '[]')
    return Array.isArray(rows) ? rows.map(normalize) : []
  } catch {
    return []
  }
}

export function saveComments(projectId: string, comments: ProjectComment[]): void {
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(comments))
  } catch { /* ignore */ }
}

/* ---------- Supabase ---------- */

function fromRow(row: Record<string, unknown>): ProjectComment {
  return normalize({
    id: String(row.id),
    path: String(row.path),
    from: Number(row.from_pos),
    to: Number(row.to_pos),
    text: String(row.text ?? ''),
    author: String(row.author ?? 'Unknown'),
    ts: Number(row.ts),
    resolved: Boolean(row.resolved),
    replies: (row.replies as CommentReply[]) ?? [],
  })
}

function toRow(projectId: string, c: ProjectComment): Record<string, unknown> {
  return {
    id: c.id,
    project_id: projectId,
    path: c.path,
    from_pos: c.from,
    to_pos: c.to,
    text: c.text,
    author: c.author,
    ts: c.ts,
    resolved: c.resolved,
    replies: c.replies,
  }
}

/** Fetch comments from Supabase; null when unreachable so callers can fall back to local storage. */
export async function fetchComments(projectId: string): Promise<ProjectComment[] | null> {
  try {
    const { data, error } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
    if (error) return null
    return (data ?? []).map(fromRow)
  } catch {
    return null
  }
}

/** Upsert one comment row. Failures are silent — the local mirror stays authoritative offline. */
export async function putComment(projectId: string, c: ProjectComment): Promise<void> {
  try {
    await supabase.from('project_comments').upsert(toRow(projectId, c))
  } catch { /* ignore */ }
}

export async function removeCommentRow(id: string): Promise<void> {
  try {
    await supabase.from('project_comments').delete().eq('id', id)
  } catch { /* ignore */ }
}

/** Relative timestamp in the "55 minutes ago" style used by the comment popover. */
export function relTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(ts).toLocaleDateString()
}
