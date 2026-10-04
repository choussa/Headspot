import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Cloud, MoreVertical, LayoutGrid, List, Settings, CircleHelp, FileText, Folder, ChevronRight,
} from 'lucide-react'
import { 
  listProjects, createNewCloudProject, deleteProject, 
  loadProject, saveProject, listFolders, createFolder, 
  deleteFolder, moveProject, type FolderMeta 
} from '../storage/cloudStore'
import type { ProjectMeta } from '../state/workspace'
import { supabase } from '../lib/supabase'

function ContextMenu({ x, y, items, close }: { x: number; y: number; items: { label: string; danger?: boolean; onClick: () => void }[]; close: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} onContextMenu={(e) => { e.preventDefault(); close() }} />
      <div className="fixed z-50 min-w-[160px] rounded-lg border border-neutral-800 bg-neutral-900 py-1 shadow-xl" style={{ top: y, left: x }}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.onClick(); close() }}
            className={`flex w-full items-center px-4 py-2 text-sm text-left hover:bg-neutral-800 ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-neutral-300 hover:text-white'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [folders, setFolders] = useState<FolderMeta[]>([])
  const [loading, setLoading] = useState(true)
  
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'modified' | 'name'>('modified')
  const [menu, setMenu] = useState<{ x: number; y: number; project?: ProjectMeta; folder?: FolderMeta } | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [projs, flds] = await Promise.all([listProjects(), listFolders()])
    setProjects(projs)
    setFolders(flds)
    setLoading(false)
  }

  async function handleCreateEmpty() {
    const id = await createNewCloudProject('Untitled Document', '#set page(paper: "a4")\n\n= New Document\nStart typing here...')
    if (id) navigate(`/editor/${id}`)
  }

  async function handleCreateFolder() {
    const name = prompt('Folder name')?.trim()
    if (!name) return
    await createFolder(name)
    load()
  }

  async function handleDeleteProject(id: string) {
    if (confirm('Delete this project?')) {
      await deleteProject(id)
      load()
    }
  }

  async function handleDeleteFolder(id: string) {
    if (confirm('Delete this folder? Projects inside will be moved to the root.')) {
      await deleteFolder(id)
      if (currentFolderId === id) setCurrentFolderId(null)
      load()
    }
  }

  async function handleMoveProject(projectId: string, folderId: string | null) {
    await moveProject(projectId, folderId)
    load()
  }

  function renameProject(project: ProjectMeta) {
    const name = prompt('Rename project', project.name)?.trim()
    if (!name) return
    ;(async () => {
      const rec = await loadProject(project.id)
      if (!rec) return
      rec.meta.name = name
      await saveProject(rec)
      load()
    })()
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDropToFolder(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    const projectId = e.dataTransfer.getData('text/project-id')
    if (projectId) {
      handleMoveProject(projectId, targetFolderId)
    }
  }

  const visibleProjects = useMemo(() => {
    const inCurrent = projects.filter((p) => (p.folderId ?? null) === currentFolderId)
    return [...inCurrent].sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt)
  }, [projects, currentFolderId, sortBy])

  const visibleFolders = currentFolderId ? [] : folders

  const currentFolderName = folders.find(f => f.id === currentFolderId)?.name

  const folderTiles = visibleFolders.map((f) => (
    <div key={f.id} className="group relative flex flex-col gap-3" onDragOver={onDragOver} onDrop={(e) => onDropToFolder(e, f.id)}>
      <div className="flex aspect-[1/1.2] w-full items-center justify-center rounded-xl bg-blue-600 shadow-sm border border-transparent hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setCurrentFolderId(f.id)}>
        <Folder size={32} className="text-white mb-4" />
        <div className="absolute inset-x-0 bottom-6 text-center font-bold text-white text-lg px-4 truncate">{f.name}</div>
      </div>
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-neutral-300 truncate">{f.name}</div>
        <button
          onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, folder: f })}
          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-200 transition-opacity"
          title="More actions"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  ))

  const projectTiles = visibleProjects.map((p) => (
    <div key={p.id} className="group relative flex flex-col gap-3" draggable onDragStart={(e) => e.dataTransfer.setData('text/project-id', p.id)}>
      {viewMode === 'grid' ? (
        <Link to={`/editor/${p.id}`} className="flex items-center justify-center aspect-[1/1.2] w-full rounded-xl bg-white border border-neutral-800 hover:border-blue-500 transition-colors overflow-hidden relative shadow-sm">
          {p.thumbnail ? (
            <div className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain" dangerouslySetInnerHTML={{ __html: p.thumbnail }} />
          ) : (
            <>
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-neutral-200/80 to-transparent" />
              <FileText className="absolute bottom-2 right-2 text-neutral-300" size={18} />
              <div className="absolute bottom-2 left-3 right-8 truncate text-xs text-neutral-500">.typ</div>
            </>
          )}
        </Link>
      ) : (
        <Link to={`/editor/${p.id}`} className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2 hover:bg-neutral-900">
          <FileText size={16} className="text-neutral-400" />
          <span className="flex-1 truncate text-sm">{p.name}</span>
          <span className="text-xs text-neutral-600">{new Date(p.updatedAt).toLocaleDateString()}</span>
        </Link>
      )}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-neutral-300 truncate">{p.name}</div>
        <button
          onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, project: p })}
          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-200 transition-opacity"
          title="More actions"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  ))

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 text-neutral-200 font-sans">
      <header className="flex h-12 items-center justify-between border-b border-neutral-900 px-5 bg-neutral-950">
        <div className="flex items-center gap-6">
          <div className="font-bold text-lg tracking-tight">typst</div>
          <nav className="flex gap-4 text-sm font-medium text-neutral-400">
            <Link to="/" className="text-white">Project</Link>
            <a href="#" className="hover:text-white">Team</a>
            <a href="#" className="hover:text-white">View</a>
            <a href="#" className="hover:text-white">Help</a>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span className="flex items-center gap-2"><Cloud size={14} /> Cloud Active</span>
          <button onClick={() => supabase.auth.signOut()} className="hover:text-white">Sign out</button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="flex w-14 flex-col items-center gap-2 border-r border-neutral-900 py-3">
          <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-800 text-xs font-bold text-white" title="User">b</div>
          <button onClick={handleCreateEmpty} title="New document" className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500"><Plus size={17} /></button>
          <button title="Settings" onClick={() => navigate('/editor/' + (projects[0]?.id ?? ''))} className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-white"><Settings size={17} /></button>
          <div className="flex-1" />
          <button title="Help" className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-white"><CircleHelp size={17} /></button>
        </aside>

        <main className="flex-1 overflow-auto p-8" onDragOver={onDragOver} onDrop={(e) => onDropToFolder(e, currentFolderId)}>
          <h1 className="text-3xl font-semibold mb-8 text-white">Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 max-w-4xl">
            <button
              onClick={handleCreateEmpty}
              className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-left hover:bg-neutral-900 hover:border-neutral-700 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300"><Plus size={20} /></div>
              <div>
                <div className="font-semibold text-white">Empty document</div>
                <div className="text-sm text-neutral-500">Start from scratch</div>
              </div>
            </button>
            <button
              title="Coming soon"
              onClick={() => alert('GitLab import coming soon')}
              className="flex items-center gap-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-6 text-left hover:bg-neutral-900 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300"><Cloud size={20} /></div>
              <div>
                <div className="font-semibold text-white">Start from GitLab</div>
                <div className="text-sm text-neutral-500">Clone a GitLab repository</div>
              </div>
            </button>
          </div>

          <nav className="mb-4 flex items-center gap-1 text-sm text-neutral-500">
            <button className="hover:text-white" onClick={() => setCurrentFolderId(null)} onDragOver={onDragOver} onDrop={(e) => onDropToFolder(e, null)}>Projects</button>
            {currentFolderId && (
              <>
                <ChevronRight size={13} />
                <span className="text-neutral-200">{currentFolderName}</span>
              </>
            )}
          </nav>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handleCreateFolder} className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-sm font-medium hover:bg-neutral-900">
                <Plus size={15} /> New folder
              </button>
              <div className="flex rounded-lg border border-neutral-800 overflow-hidden">
                <button title="Grid" onClick={() => setViewMode('grid')} className={`px-2.5 py-1.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-white'}`}><LayoutGrid size={15} /></button>
                <button title="List" onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-white'}`}><List size={15} /></button>
              </div>
            </div>
            <div className="text-sm text-neutral-500">
              sort by{' '}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'modified' | 'name')} className="bg-transparent text-white font-medium outline-none ml-1">
                <option value="modified">last modified</option>
                <option value="name">name</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-neutral-500">Loading projects...</div>
          ) : visibleProjects.length + visibleFolders.length === 0 ? (
            <div className="text-neutral-500">Nothing here yet. Create a document or folder above.</div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6' : 'flex flex-col gap-3 max-w-3xl'}>
              {viewMode === 'grid' ? folderTiles : null}
              {projectTiles}
            </div>
          )}
        </main>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          close={() => setMenu(null)}
          items={
            menu.project ? [
              { label: 'Rename', onClick: () => renameProject(menu.project!) },
              { label: 'Move to root', onClick: () => handleMoveProject(menu.project!.id, null) },
              ...folders.map((f) => ({ label: `Move to ${f.name}`, onClick: () => handleMoveProject(menu.project!.id, f.id) })),
              { label: 'Delete', danger: true, onClick: () => handleDeleteProject(menu.project!.id) },
            ] : [
              { label: 'Delete Folder', danger: true, onClick: () => handleDeleteFolder(menu.folder!.id) },
            ]
          }
        />
      )}
    </div>
  )
}
