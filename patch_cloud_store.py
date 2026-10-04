import re

with open('src/storage/cloudStore.ts', 'r') as f:
    code = f.read()

# Add FolderMeta to workspace imports or define it
# We'll just define it inline in cloudStore.ts to avoid touching workspace.ts yet.
if "export interface FolderMeta" not in code:
    code = code.replace("export async function listProjects()", "export interface FolderMeta { id: string; name: string }\n\nexport async function listProjects()")

# Add folder_id to listProjects select
code = code.replace(".select('id, name, created_at, updated_at')", ".select('id, name, folder_id, created_at, updated_at')")

# Add folderId to the returned objects
code = code.replace("name: row.name,\n    createdAt", "name: row.name,\n    folderId: row.folder_id,\n    createdAt")

# Add Folder functions
if "export async function listFolders" not in code:
    folders_code = """
export async function listFolders(): Promise<FolderMeta[]> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return []
  const { data, error } = await supabase.from('folders').select('id, name').eq('owner_id', user.user.id).order('created_at', { ascending: true })
  return data || []
}

export async function createFolder(name: string): Promise<FolderMeta | null> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null
  const { data, error } = await supabase.from('folders').insert({ owner_id: user.user.id, name }).select('id, name').single()
  return data || null
}

export async function deleteFolder(id: string): Promise<void> {
  await supabase.from('folders').delete().eq('id', id)
}

export async function moveProject(projectId: string, folderId: string | null): Promise<void> {
  await supabase.from('projects').update({ folder_id: folderId }).eq('id', projectId)
}
"""
    code = code + folders_code

with open('src/storage/cloudStore.ts', 'w') as f:
    f.write(code)
