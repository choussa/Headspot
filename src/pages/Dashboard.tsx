import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Cloud, MoreVertical, LayoutGrid, List, FileText, Folder, ChevronRight,
  Loader2, TriangleAlert, RefreshCw, Monitor, Sun, Moon,
} from 'lucide-react'
import blankTpl from '../templates/blank.typ?raw'
import statusTpl from '../templates/project-status.typ?raw'
import quarterlyTpl from '../templates/quarterly-report.typ?raw'

const TEMPLATES = [
  { id: 'blank', name: 'Blank Document', source: blankTpl },
  { id: 'project-status', name: 'Project Status', source: statusTpl },
  { id: 'quarterly-report', name: 'Quarterly Report', source: quarterlyTpl },
]
import {
  listProjects, createNewCloudProject, deleteProject,
  loadProject, saveProject, listFolders, createFolder,
  deleteFolder, renameFolder, moveProject, type FolderMeta,
} from '../storage/cloudStore'
import type { ProjectMeta } from '../state/workspace'
import { supabase } from '../lib/supabase'
import { usePreferences } from '../state/preferences'
import { ConfirmDialog, PromptDialog } from '../components/Dialogs'

const TILE_RATIO = 'aspect-[4/5]'

function ContextMenu({ x, y, items, close }: {
  x: number
  y: number
  items: { label: string; danger?: boolean; onClick: () => void }[]
  close: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - width - 8)
    const top = Math.min(y, window.innerHeight - height - 8)
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={close}
        onContextMenu={(e) => { e.preventDefault(); close() }}
      />
      <div
        ref={ref}
        role="menu"
        className="fixed z-50 min-w-[168px] overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,.5)]"
      >
        {items.map((item, i) => (
          <button
            key={i}
            role="menuitem"
            onClick={() => { item.onClick(); close() }}
            className={`block w-full px-4 py-2 text-left text-[13px] transition-colors hover:bg-rail ${
              item.danger ? 'text-danger hover:bg-danger/10' : 'text-fg-2 hover:text-fg'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

function TileMenu({ onOpen, label }: { onOpen: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button
      onClick={onOpen}
      aria-label={`More actions for ${label}`}
      className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100"
    >
      <MoreVertical size={14} />
    </button>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className={`w-full animate-pulse rounded-xl bg-panel ${TILE_RATIO}`} />
          <div className="mx-1 h-3.5 w-2/3 animate-pulse rounded bg-panel" />
        </div>
      ))}
    </div>
  )
}

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [folders, setFolders] = useState<FolderMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'modified' | 'name'>('modified')
  const [menu, setMenu] = useState<{ x: number; y: number; project?: ProjectMeta; folder?: FolderMeta } | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  // One dialog at a time, so destructive confirms never stack on prompts.
  const [dialog, setDialog] = useState<
    | { kind: 'none' }
    | { kind: 'new-folder' }
    | { kind: 'rename-folder'; folder: FolderMeta }
    | { kind: 'delete-folder'; folder: FolderMeta }
    | { kind: 'rename-project'; project: ProjectMeta }
    | { kind: 'delete-project'; project: ProjectMeta }
  >({ kind: 'none' })

  const navigate = useNavigate()
  const { prefs, update } = usePreferences()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [])

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
      setError(null)
    }
    try {
      const [projs, flds] = await Promise.all([listProjects(), listFolders()])
      setProjects(projs)
      setFolders(flds)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetching from Supabase on mount is exactly the external-system sync this
  // effect hook exists for; the rule cannot see past the await boundary.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load(false) }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action did not complete.')
    } finally {
      setBusy(false)
      setDialog({ kind: 'none' })
    }
  }

  const handleCreateEmpty = () =>
    run(async () => {
      const id = await createNewCloudProject('Untitled Document', '#set page(paper: "a4")\n\n= New Document\nStart typing here...')
      if (!id) throw new Error('Could not create a document. Check your connection and try again.')
      navigate(`/editor/${id}`)
    })

  const handleCreateFromTemplate = (t: (typeof TEMPLATES)[number]) =>
    run(async () => {
      const id = await createNewCloudProject(t.name, t.source)
      if (!id) throw new Error('Could not create a document. Check your connection and try again.')
      setShowTemplates(false)
      navigate(`/editor/${id}`)
    })

  const currentFolderName = folders.find(f => f.id === currentFolderId)?.name

  const visibleProjects = useMemo(() => {
    const inCurrent = projects.filter((p) => (p.folderId ?? null) === currentFolderId)
    return [...inCurrent].sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt,
    )
  }, [projects, currentFolderId, sortBy])

  const visibleFolders = currentFolderId ? [] : folders
  const isEmpty = visibleProjects.length + visibleFolders.length === 0

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDropToFolder(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    const projectId = e.dataTransfer.getData('text/project-id')
    if (projectId) void run(() => moveProject(projectId, targetFolderId))
  }

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  )

  const folderTiles = visibleFolders.map((f) =>
    viewMode === 'grid' ? (
      <div
        key={f.id}
        className="group relative flex flex-col gap-3"
        onDragOver={onDragOver}
        onDrop={(e) => onDropToFolder(e, f.id)}
      >
        <div
          onClick={() => setCurrentFolderId(f.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentFolderId(f.id) } }}
          role="button"
          tabIndex={0}
          aria-label={`Open folder ${f.name}`}
          className={`relative flex w-full cursor-pointer items-end justify-center rounded-xl border border-line bg-raised pb-4 transition-colors hover:border-accent ${TILE_RATIO}`}
        >
          <Folder size={30} className="mb-3 text-brand" />
          <span className="px-4 text-center text-sm font-semibold text-fg">{f.name}</span>
        </div>
        <TileMenu
          label={f.name}
          onOpen={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, folder: f }) }}
        />
      </div>
    ) : (
      <div
        key={f.id}
        className="group relative"
        onDragOver={onDragOver}
        onDrop={(e) => onDropToFolder(e, f.id)}
      >
        <button
          onClick={() => setCurrentFolderId(f.id)}
          className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:bg-panel"
        >
          <Folder size={16} className="shrink-0 text-brand" />
          <span className="flex-1 truncate text-sm text-fg">{f.name}</span>
          <span className="shrink-0 text-xs text-fg-3">Folder</span>
        </button>
        <div className="absolute right-1.5 top-1.5">
          <TileMenu
            label={f.name}
            onOpen={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, folder: f }) }}
          />
        </div>
      </div>
    ),
  )

  const projectTiles = visibleProjects.map((p) =>
    viewMode === 'grid' ? (
      <div
        key={p.id}
        className="group relative flex flex-col gap-3"
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/project-id', p.id)}
      >
        <Link
          to={`/editor/${p.id}`}
          aria-label={`Open ${p.name}`}
          className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-raised transition-colors hover:border-accent ${TILE_RATIO}`}
        >
          {p.thumbnail ? (
            <div
              className="pointer-events-none h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: p.thumbnail }}
            />
          ) : (
            <>
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/[.06] to-transparent" />
              <FileText size={18} className="absolute bottom-2 right-2 text-fg-3" />
              <div className="absolute bottom-2 left-3 right-8 truncate text-xs text-fg-3">.typ</div>
            </>
          )}
        </Link>
        <TileMenu
          label={p.name}
          onOpen={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, project: p }) }}
        />
        <div className="truncate px-1 text-sm font-medium text-fg-2">{p.name}</div>
      </div>
    ) : (
      <div
        key={p.id}
        className="group relative"
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/project-id', p.id)}
      >
        <Link
          to={`/editor/${p.id}`}
          className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 transition-colors hover:bg-panel"
        >
          <FileText size={16} className="shrink-0 text-fg-3" />
          <span className="flex-1 truncate text-sm text-fg">{p.name}</span>
          <span className="tnum shrink-0 text-xs text-fg-3">{dateFormat.format(p.updatedAt)}</span>
        </Link>
        <div className="absolute right-1.5 top-1.5">
          <TileMenu
            label={p.name}
            onOpen={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, project: p }) }}
          />
        </div>
      </div>
    ),
  )

  const ThemeControl = (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5" role="group" aria-label="Color theme">
      {([
        { value: 'light', label: 'Light', Icon: Sun },
        { value: 'dark', label: 'Dark', Icon: Moon },
        { value: 'system', label: 'System', Icon: Monitor },
      ] as const).map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => update('theme', value)}
          aria-pressed={prefs.theme === value}
          title={label}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            prefs.theme === value ? 'bg-rail text-fg' : 'text-fg-3 hover:text-fg'
          }`}
        >
          <Icon size={14} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex h-screen w-screen flex-col bg-app font-sans text-fg">
      <header className="flex h-[36px] shrink-0 items-center justify-between border-b border-line bg-topbar px-4 text-[13px]">
        <Link to="/" className="font-bold text-fg">
          <span className="sr-only">Headspot home</span>
          <span aria-hidden="true">typst</span>
        </Link>
        <div className="flex items-center gap-3 font-medium text-fg-2">
          <span className="hidden items-center gap-2 sm:flex">
            <span className="cloud-dot" aria-hidden="true" />
            <Cloud size={14} />
            Synced
          </span>
          {ThemeControl}
          <button
            onClick={() => void supabase.auth.signOut()}
            className="rounded px-1 py-1 text-fg-2 transition-colors hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-topbar py-3">
          <span
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-fill text-xs font-bold text-white"
            title={email ? `Signed in as ${email}` : 'Signed in'}
          >
            {userInitial(email)}
          </span>
          <button
            onClick={handleCreateEmpty}
            disabled={busy}
            title="New document"
            aria-label="New document"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-fill text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            <Plus size={17} />
          </button>
          <div className="flex-1" />
        </aside>

        <main
          className="min-w-0 flex-1 overflow-auto p-8"
          onDragOver={onDragOver}
          onDrop={(e) => onDropToFolder(e, currentFolderId)}
        >
          <h1 className="mb-8 text-3xl font-semibold text-fg">
            {currentFolderName ?? 'Dashboard'}
          </h1>

          <div className="mb-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
            <button
              onClick={handleCreateEmpty}
              disabled={busy}
              className="flex items-center gap-4 rounded-xl border border-line bg-panel p-6 text-left transition-colors hover:bg-raised disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-raised text-fg-2">
                <Plus size={20} />
              </span>
              <span>
                <span className="block font-semibold text-fg">Empty document</span>
                <span className="block text-sm text-fg-3">Start from scratch</span>
              </span>
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              disabled={busy}
              className="flex items-center gap-4 rounded-xl border border-line bg-panel p-6 text-left transition-colors hover:bg-raised disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-raised text-fg-2">
                <FileText size={20} />
              </span>
              <span>
                <span className="block font-semibold text-fg">Start from template</span>
                <span className="block text-sm text-fg-3">Pick a ready-made layout</span>
              </span>
            </button>
            <div
              title="Not available yet"
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-4 rounded-xl border border-dashed border-line bg-panel/40 p-6 text-left opacity-60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-raised text-fg-3">
                <Cloud size={20} />
              </span>
              <span>
                <span className="block font-semibold text-fg-2">Start from GitLab</span>
                <span className="block text-sm text-fg-3">Coming soon</span>
              </span>
            </div>
          </div>

          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-fg-3">
            <button
              onClick={() => setCurrentFolderId(null)}
              onDragOver={onDragOver}
              onDrop={(e) => onDropToFolder(e, null)}
              className="rounded transition-colors hover:text-fg"
            >
              Projects
            </button>
            {currentFolderId && (
              <>
                <ChevronRight size={13} aria-hidden="true" />
                <span className="text-fg-2">{currentFolderName}</span>
              </>
            )}
          </nav>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDialog({ kind: 'new-folder' })}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-panel"
              >
                <Plus size={15} /> New folder
              </button>
              <div className="flex overflow-hidden rounded-lg border border-line">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                  className={`px-2.5 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-accent-fill text-white' : 'text-fg-3 hover:text-fg'}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                  className={`px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent-fill text-white' : 'text-fg-3 hover:text-fg'}`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-fg-3">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'modified' | 'name')}
                className="rounded-md border border-control bg-raised px-2 py-1 font-medium text-fg"
              >
                <option value="modified">Last modified</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {error && (
            <div role="alert" className="mb-6 flex max-w-2xl items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Could not reach your workspace</p>
                <p className="mt-0.5 break-words text-[13px] text-fg-2">{error}</p>
              </div>
              <button
                onClick={() => void load()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-line"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {loading ? (
            <>
              <span role="status" className="sr-only">Loading your documents</span>
              <SkeletonGrid />
            </>
          ) : isEmpty ? (
            <div className="max-w-2xl rounded-xl border border-dashed border-line p-10 text-center">
              <h2 className="text-base font-semibold text-fg">
                {currentFolderId ? 'This folder is empty' : 'No documents yet'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-2">
                {currentFolderId
                  ? 'Drag a document here from Projects, or create a new one.'
                  : 'Create your first document to start writing, or make a folder to keep things organised.'}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button
                  onClick={handleCreateEmpty}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
                >
                  <Plus size={15} /> New document
                </button>
                {!currentFolderId && (
                  <button
                    onClick={() => setDialog({ kind: 'new-folder' })}
                    className="rounded-lg border border-line bg-raised px-3.5 py-2 text-sm font-medium transition-colors hover:bg-line"
                  >
                    New folder
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {busy && (
                <span role="status" className="mb-3 inline-flex items-center gap-2 text-[13px] text-fg-3">
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </span>
              )}
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                    : 'flex max-w-3xl flex-col gap-2'
                }
              >
                {folderTiles}
                {projectTiles}
              </div>
            </>
          )}
        </main>
      </div>

      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setShowTemplates(false)}>
          <div className="w-full max-w-md rounded-xl border border-line bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-fg">Start from a template</h2>
            <div className="flex flex-col gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleCreateFromTemplate(t)}
                  disabled={busy}
                  className="rounded-lg border border-line px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:bg-raised disabled:opacity-50"
                >
                  {t.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="mt-4 rounded-lg border border-line px-4 py-2 text-sm text-fg-2 transition-colors hover:bg-raised"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          close={() => setMenu(null)}
          items={
            menu.project ? [
              { label: 'Rename', onClick: () => setDialog({ kind: 'rename-project', project: menu.project! }) },
              ...(menu.project.folderId
                ? [{ label: 'Move to root', onClick: () => void run(() => moveProject(menu.project!.id, null)) }]
                : []),
              ...folders.map((f) => ({
                label: `Move to ${f.name}`,
                onClick: () => void run(() => moveProject(menu.project!.id, f.id)),
              })),
              { label: 'Delete', danger: true, onClick: () => setDialog({ kind: 'delete-project', project: menu.project! }) },
            ] : [
              { label: 'Rename', onClick: () => setDialog({ kind: 'rename-folder', folder: menu.folder! }) },
              { label: 'Delete', danger: true, onClick: () => setDialog({ kind: 'delete-folder', folder: menu.folder! }) },
            ]
          }
        />
      )}

      <PromptDialog
        open={dialog.kind === 'new-folder'}
        title="New folder"
        description="Folders group documents. You can drag documents into them."
        placeholder="Quarterly reports"
        confirmLabel="Create folder"
        onCancel={() => setDialog({ kind: 'none' })}
        onConfirm={(name) => void run(() => createFolder(name))}
      />

      <PromptDialog
        open={dialog.kind === 'rename-folder'}
        title="Rename folder"
        initialValue={dialog.kind === 'rename-folder' ? dialog.folder.name : ''}
        confirmLabel="Rename"
        onCancel={() => setDialog({ kind: 'none' })}
        onConfirm={(name) => {
          if (dialog.kind !== 'rename-folder') return
          const folder = dialog.folder
          void run(() => renameFolder(folder.id, name))
        }}
      />

      <PromptDialog
        open={dialog.kind === 'rename-project'}
        title="Rename document"
        initialValue={dialog.kind === 'rename-project' ? dialog.project.name : ''}
        confirmLabel="Rename"
        onCancel={() => setDialog({ kind: 'none' })}
        onConfirm={(name) => {
          if (dialog.kind !== 'rename-project') return
          const project = dialog.project
          void run(async () => {
            const rec = await loadProject(project.id)
            if (!rec) throw new Error('That document no longer exists.')
            rec.meta.name = name
            await saveProject(rec)
          })
        }}
      />

      <ConfirmDialog
        open={dialog.kind === 'delete-project'}
        title="Delete document?"
        description={
          dialog.kind === 'delete-project'
            ? `"${dialog.project.name}" and its files will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDialog({ kind: 'none' })}
        onConfirm={() => {
          if (dialog.kind !== 'delete-project') return
          const project = dialog.project
          void run(() => deleteProject(project.id))
        }}
      />

      <ConfirmDialog
        open={dialog.kind === 'delete-folder'}
        title="Delete folder?"
        description={
          dialog.kind === 'delete-folder'
            ? `"${dialog.folder.name}" will be removed. Documents inside it are kept and moved back to Projects.`
            : undefined
        }
        confirmLabel="Delete folder"
        destructive
        onCancel={() => setDialog({ kind: 'none' })}
        onConfirm={() => {
          if (dialog.kind !== 'delete-folder') return
          const folder = dialog.folder
          void run(async () => {
            await deleteFolder(folder.id)
            setCurrentFolderId((cur) => (cur === folder.id ? null : cur))
          })
        }}
      />
    </div>
  )
}

function userInitial(email: string | null): string {
  const local = email?.split('@')[0]?.trim()
  return local ? local[0]!.toUpperCase() : '?'
}
