import { supabase } from '../lib/supabase'
import type { ProjectMeta, ProjectRecord, ProjectFile } from '../state/workspace'
import { MAIN_PATH } from '../state/workspace'

export interface FolderMeta { id: string; name: string }

export async function listProjects(): Promise<ProjectMeta[]> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return []

  const { data, error: err } = await supabase
    .from('projects')
    .select('id, name, folder_id, thumbnail, created_at, updated_at')
    .eq('owner_id', user.user.id)
    .order('updated_at', { ascending: false })

  if (err) {
    console.error('Error fetching projects:', err)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    thumbnail: row.thumbnail,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }))
}

export async function loadProject(id: string): Promise<ProjectRecord | undefined> {
  const { data: projectData, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (projErr || !projectData) return undefined

  const { data: fileData, error: fileErr } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', id)

  if (fileErr) return undefined

  return {
    meta: {
      id: projectData.id,
      name: projectData.name,
      thumbnail: projectData.thumbnail,
      createdAt: new Date(projectData.created_at).getTime(),
      updatedAt: new Date(projectData.updated_at).getTime(),
    },
    files: await Promise.all(fileData.map(async (f: any) => {
      if (f.kind === 'asset') {
        const { data: blob, error: dlErr } = await supabase.storage.from('project-assets').download(`${id}${f.path}`)
        if (dlErr || !blob) {
          console.error('Error downloading asset:', dlErr)
          return { path: f.path, kind: f.kind } as ProjectFile
        }
        return { path: f.path, kind: f.kind, data: new Uint8Array(await blob.arrayBuffer()) } as ProjectFile
      }
      return { path: f.path, kind: f.kind, text: f.text } as ProjectFile
    })),
  }
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return

  // 1. Upsert project
  const { error: projErr } = await supabase
    .from('projects')
    .upsert({
      id: record.meta.id,
      owner_id: user.user.id,
      name: record.meta.name,
      thumbnail: record.meta.thumbnail,
      updated_at: new Date().toISOString(),
    })
  
  if (projErr) {
    console.error('Error saving project metadata:', projErr)
    return
  }

  // 2. Upsert files
  const filePayload = record.files.map((f) => ({
    project_id: record.meta.id,
    path: f.path,
    kind: f.kind,
    text: f.kind === 'source' ? f.text : null,
    updated_at: new Date().toISOString(),
  }))

  const { error: fileErr } = await supabase
    .from('project_files')
    .upsert(filePayload, { onConflict: 'project_id, path' })

  if (fileErr) {
    console.error('Error saving project files:', fileErr)
  }

  const bucket = supabase.storage.from('project-assets')
  for (const f of record.files) {
    if (f.kind === 'asset' && f.data) {
      const { error: upErr } = await bucket.upload(`${record.meta.id}${f.path}`, new Blob([f.data as BlobPart]), { upsert: true })
      if (upErr) console.error('Error uploading asset:', upErr)
    }
  }
}

export async function createNewCloudProject(name: string, source: string): Promise<string | null> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({ owner_id: user.user.id, name })
    .select()
    .single()
  
  if (projErr || !project) return null

  const { error: fileErr } = await supabase
    .from('project_files')
    .insert({
      project_id: project.id,
      path: MAIN_PATH,
      kind: 'source',
      text: source
    })
  
  if (fileErr) return null
  return project.id
}

export async function deleteProject(id: string): Promise<void> {
  const { data: list } = await supabase.storage.from('project-assets').list(id)
  const keys: string[] = []
  for (const item of list || []) {
    if (item.id) keys.push(`${id}/${item.name}`)
    else {
      const { data: sub } = await supabase.storage.from('project-assets').list(`${id}/${item.name}`)
      for (const s of sub || []) keys.push(`${id}/${item.name}/${s.name}`)
    }
  }
  if (keys.length > 0) await supabase.storage.from('project-assets').remove(keys)
  await supabase.from('projects').delete().eq('id', id)
}

export { MAIN_PATH }

export async function listFolders(): Promise<FolderMeta[]> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return []
  const { data } = await supabase.from('folders').select('id, name').eq('owner_id', user.user.id).order('created_at', { ascending: true })
  return data || []
}

export async function createFolder(name: string): Promise<FolderMeta | null> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null
  const { data } = await supabase.from('folders').insert({ owner_id: user.user.id, name }).select('id, name').single()
  return data || null
}

export async function deleteFolder(id: string): Promise<void> {
  await supabase.from('folders').delete().eq('id', id)
}

export async function moveProject(projectId: string, folderId: string | null): Promise<void> {
  await supabase.from('projects').update({ folder_id: folderId }).eq('id', projectId)
}
