export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface ProjectFile {
  path: string
  kind: 'source' | 'asset'
  text?: string
  data?: Uint8Array
}

export interface ProjectRecord {
  meta: ProjectMeta
  files: ProjectFile[]
}

export interface Workspace {
  index: ProjectMeta[]
  activeId: string
  activeFilePath: string
  record: ProjectRecord
}

export const MAIN_PATH = '/main.typ'

export function normalizePath(p: string): string {
  let path = p.trim().replace(/\\/g, '/')
  if (!path.startsWith('/')) path = '/' + path
  return path.replace(/\/+/g, '/')
}

export function newProjectId(): string {
  return crypto.randomUUID()
}

export function createProject(name: string, seedSource: string): ProjectRecord {
  const now = Date.now()
  return {
    meta: { id: newProjectId(), name, createdAt: now, updatedAt: now },
    files: [{ path: MAIN_PATH, kind: 'source', text: seedSource }],
  }
}

export function setFileText(files: ProjectFile[], path: string, text: string): ProjectFile[] {
  const p = normalizePath(path)
  return files.map((f) => (f.path === p ? { ...f, text } : f))
}

export function addFile(files: ProjectFile[], path: string, text: string): ProjectFile[] {
  const p = normalizePath(path)
  if (files.some((f) => f.path === p)) return files
  return [...files, { path: p, kind: 'source', text }]
}

export function deleteFile(files: ProjectFile[], path: string): ProjectFile[] {
  const p = normalizePath(path)
  if (p === MAIN_PATH) return files
  return files.filter((f) => f.path !== p)
}

export function addAsset(files: ProjectFile[], path: string, data: Uint8Array): ProjectFile[] {
  const p = normalizePath(path)
  const rest = files.filter((f) => f.path !== p)
  return [...rest, { path: p, kind: 'asset', data }]
}

export function fileByPath(files: ProjectFile[], path: string): ProjectFile | undefined {
  return files.find((f) => f.path === normalizePath(path))
}

export interface TreeNode {
  name: string
  path: string
  kind: 'folder' | 'source' | 'asset'
  children: TreeNode[]
}

export function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '/', kind: 'folder', children: [] }
  const folders = new Map<string, TreeNode>([['/', root]])

  const ensureFolder = (dirPath: string): TreeNode => {
    const existing = folders.get(dirPath)
    if (existing) return existing
    const parentDir = dirPath.slice(0, dirPath.lastIndexOf('/')) || '/'
    const parent = ensureFolder(parentDir)
    const node: TreeNode = { name: dirPath.slice(dirPath.lastIndexOf('/') + 1), path: dirPath, kind: 'folder', children: [] }
    parent.children.push(node)
    folders.set(dirPath, node)
    return node
  }

  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const dir = f.path.slice(0, f.path.lastIndexOf('/')) || '/'
    const parent = ensureFolder(dir)
    parent.children.push({ name: f.path.slice(f.path.lastIndexOf('/') + 1), path: f.path, kind: f.kind, children: [] })
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1))
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(root.children)
  return root.children
}
