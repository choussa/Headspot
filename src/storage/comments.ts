export interface ProjectComment {
  id: string
  path: string
  from: number
  to: number
  text: string
  author: string
  ts: number
  resolved: boolean
}

const KEY = (id: string) => `typst:comments:${id}`

export function listComments(projectId: string): ProjectComment[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(projectId)) ?? '[]')
  } catch {
    return []
  }
}

export function saveComments(projectId: string, comments: ProjectComment[]): void {
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(comments))
  } catch { /* ignore */ }
}
