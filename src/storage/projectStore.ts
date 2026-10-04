import { get, set, del } from 'idb-keyval'
import type { ProjectMeta, ProjectRecord, ProjectFile } from '../state/workspace'
import { MAIN_PATH, createProject } from '../state/workspace'

const INDEX_KEY = 'project-index'
const projectKey = (id: string) => `project:${id}`
const LEGACY_KEY = 'typst-project'

export async function listProjects(): Promise<ProjectMeta[]> {
  return (await get<ProjectMeta[]>(INDEX_KEY)) ?? []
}

export async function loadProject(id: string): Promise<ProjectRecord | undefined> {
  return get<ProjectRecord>(projectKey(id))
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  record.meta.updatedAt = Date.now()
  await set(projectKey(record.meta.id), record)
  const index = await listProjects()
  const next = [record.meta, ...index.filter((m) => m.id !== record.meta.id)]
  await set(INDEX_KEY, next)
}

export async function deleteProject(id: string): Promise<void> {
  await del(projectKey(id))
  const index = await listProjects()
  await set(INDEX_KEY, index.filter((m) => m.id !== id))
}

interface LegacyProject { id: string; name: string; source: string; updatedAt: number }

export async function migrateLegacy(): Promise<ProjectRecord | undefined> {
  const legacy = await get<LegacyProject>(LEGACY_KEY)
  if (!legacy) return undefined
  const record = createProject(legacy.name || 'imported', legacy.source)
  record.meta.createdAt = legacy.updatedAt
  await saveProject(record)
  await del(LEGACY_KEY)
  return record
}

export { MAIN_PATH }
export type { ProjectFile }
