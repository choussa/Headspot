import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Project } from '../compiler/project'
import { downloadBlob, svgToPngBlob, zipEntries } from '../compiler/exporters'
import { loadFonts } from '../storage/fontLoader'
import { TypstEditor } from '../editor/TypstEditor'
import { CollabManager, type CollabSession } from '../editor/collab'
import { VirtualizedPreview } from '../preview/VirtualizedPreview'
import { SplitPane } from '../components/SplitPane'
import { FileTree } from '../components/FileTree'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  listProjects, loadProject, saveProject, deleteProject,
} from '../storage/cloudStore'
import {
  createProject, addFile, deleteFile, setFileText, addAsset, fileByPath,
  normalizePath, type ProjectRecord, type ProjectFile,
} from '../state/workspace'
import type { Diagnostic, PageInfo, PreviewNavigator } from '@vedivad/typst-web-service'
import type { EditorView } from '@codemirror/view'
import { undo, redo, selectAll } from '@codemirror/commands'
import { openSearchPanel, closeSearchPanel, searchPanelOpen } from '@codemirror/search'
import blank from '../templates/blank.typ?raw'
import { usePreferences } from '../state/preferences'
import { supabase } from '../lib/supabase'
import { Menu, type MenuItem } from '../components/Menu'
import { SettingsPanel } from '../components/SettingsPanel'
import { ExportPanel } from '../components/ExportPanel'
import { ConfirmDialog, PromptDialog } from '../components/Dialogs'
import {
  ArrowLeft, Search, Settings, Download, Undo2, Redo2, Loader2,
  RotateCw, Minus, Plus, Maximize2, ChevronDown, List, ListOrdered, Sigma, Code, AtSign,
  TriangleAlert,
  Globe, BookOpen, Package, Leaf, CircleHelp, Cloud, Terminal, Layout, Book
} from 'lucide-react'

const project = new Project()

type ExportFormat = 'pdf' | 'zip' | 'svg' | 'png'

/** Filesystem-safe download name derived from the project title. */
function baseName(name: string | null | undefined): string {
  const slug = (name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'document'
}

export function EditorPage() {
  const { id } = useParams<{id: string}>()
  const navigate = useNavigate()
  const [record, setRecord] = useState<ProjectRecord | null>(null)
  const [activeFilePath, setActiveFilePath] = useState('/main.typ')
  const [pages, setPages] = useState<PageInfo[]>([])
  const [compileSeq, setCompileSeq] = useState(0)
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const exporting = exportingFormat !== null
  const [zoom, setZoom] = useState(75)
  const [ready, setReady] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [activePanel, setActivePanel] = useState<string | null>('files')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingDeleteFile, setPendingDeleteFile] = useState<string | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const { prefs, update } = usePreferences()
  const compileTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const runCompile = useCallback(async (files: ProjectFile[]) => {
    setCompiling(true)
    try {
      const res = await project.compileProject(files)
      if (res) {
        setPages(res.pages)
        setDiagnostics(res.diagnostics)
        setCompileSeq((n) => n + 1)
        if (res.pages.length > 0) {
          project.renderPage(0).then(svg => {
            if (svg) {
              setRecord(prev => {
                if (!prev) return prev
                if (prev.meta.thumbnail === svg) return prev
                const next = { ...prev, meta: { ...prev.meta, thumbnail: svg } }
                saveProject(next)
                return next
              })
            }
          })
        }
      }
    } finally {
      setCompiling(false)
    }
  }, [])

  // The WASM engine is process-wide: initialize it exactly once.
  useEffect(() => {
    ;(async () => {
      try {
        const fonts = await loadFonts()
        await project.init(fonts)
        setReady(true)
      } catch (e) {
        console.error('Typst initialization failed', e)
      }
    })()
  }, [])

  // Load whichever project the route points at, including on project switch.
  useEffect(() => {
    if (!ready || !id) return
    ;(async () => {
      const loaded = await loadProject(id)
      if (loaded) {
        setRecord(loaded)
        setActiveFilePath('/main.typ')
        await runCompile(loaded.files)
      } else {
        navigate('/')
      }
    })()
  }, [id, ready, runCompile, navigate])

  const persist = useCallback((rec: ProjectRecord) => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveProject(rec), 600)
  }, [])

  const updateFiles = useCallback((files: ProjectFile[]) => {
    setRecord((prev) => {
      if (!prev) return prev
      const next = { ...prev, files }
      persist(next)
      return next
    })
  }, [persist])

  const onEditorChange = useCallback((text: string) => {
    setRecord((prev) => {
      if (!prev) return prev
      const next = { ...prev, files: setFileText(prev.files, activeFilePath, text) }
      window.clearTimeout(compileTimer.current)
      compileTimer.current = window.setTimeout(() => runCompile(next.files), 150)
      persist(next)
      return next
    })
  }, [activeFilePath, runCompile, persist])

  const onNewFile = useCallback((path: string) => {
    const p = normalizePath(/\.[a-z0-9]+$/i.test(path.trim()) ? path.trim() : path.trim() + '.typ')
    if (!record) return
    const files = addFile(record.files, p, '')
    updateFiles(files)
    setActiveFilePath(p)
  }, [record, updateFiles])

  const onDeleteFile = useCallback((path: string) => {
    if (!record) return
    updateFiles(deleteFile(record.files, path))
    if (activeFilePath === path) setActiveFilePath('/main.typ')
  }, [record, updateFiles, activeFilePath])

  const onUploadAsset = useCallback((path: string, data: Uint8Array) => {
    if (!record) return
    updateFiles(addAsset(record.files, path, data))
  }, [record, updateFiles])

  const onDeleteProject = useCallback(async () => {
    if (!record) return
    await deleteProject(record.meta.id)
    const metas = await listProjects()
    const next = metas[0] ? await loadProject(metas[0].id) : undefined
    if (next) {
      setRecord(next)
      setActiveFilePath('/main.typ')
      await runCompile(next.files)
    } else {
      const fresh = createProject('Untitled', blank)
      await saveProject(fresh)
      setRecord(fresh)
      await runCompile(fresh.files)
    }
  }, [record, runCompile])

  const onExportPdf = useCallback(async () => {
    if (!record) return
    setExportingFormat('pdf')
    try {
      const pdf = await project.exportPdf()
      downloadBlob(new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' }), `${baseName(record.meta.name)}.pdf`)
    } finally {
      setExportingFormat(null)
    }
  }, [project, record])

  const onExportSources = useCallback(async () => {
    if (!record) return
    setExportingFormat('zip')
    try {
      const entries = record.files.map((f) => ({
        // Zip paths must be relative; ProjectFile paths are absolute.
        path: f.path.replace(/^\/+/, '') || 'main.typ',
        data: f.kind === 'source' ? (f.text ?? '') : (f.data ?? new Uint8Array()),
      }))
      downloadBlob(await zipEntries(entries), `${baseName(record.meta.name)}-sources.zip`)
    } finally {
      setExportingFormat(null)
    }
  }, [record])

  const onExportSvg = useCallback(async () => {
    if (pages.length === 0) return
    setExportingFormat('svg')
    try {
      const rendered = await project.renderedPages(0, pages.length)
      if (rendered.length === 1) {
        downloadBlob(
          new Blob([rendered[0].svg], { type: 'image/svg+xml' }),
          `${baseName(record?.meta.name ?? 'document')}.svg`,
        )
        return
      }
      const entries = rendered.map((p) => ({
        path: `page-${p.index + 1}.svg`,
        data: p.svg,
      }))
      downloadBlob(await zipEntries(entries), `${baseName(record?.meta.name ?? 'document')}-svg.zip`)
    } finally {
      setExportingFormat(null)
    }
  }, [pages.length, record])

  const onExportPng = useCallback(async () => {
    if (pages.length === 0) return
    setExportingFormat('png')
    try {
      const rendered = await project.renderedPages(0, pages.length)
      const entries = await Promise.all(
        rendered.map(async (p) => ({
          path: `page-${p.index + 1}.png`,
          data: new Uint8Array(
            await (await svgToPngBlob(p.svg, p.width, p.height)).arrayBuffer(),
          ),
        })),
      )
      if (entries.length === 1) {
        downloadBlob(new Blob([entries[0].data], { type: 'image/png' }), `${baseName(record?.meta.name ?? 'document')}.png`)
        return
      }
      downloadBlob(await zipEntries(entries), `${baseName(record?.meta.name ?? 'document')}-png.zip`)
    } finally {
      setExportingFormat(null)
    }
  }, [pages.length, record])

  const onShareLink = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setShareUrl(url)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [])

  const viewItems: MenuItem[] = [
    { label: 'File panel', checked: activePanel === 'files', onSelect: () => setActivePanel(activePanel === 'files' ? null : 'files') },
    { label: 'Settings panel', checked: activePanel === 'settings', onSelect: () => setActivePanel(activePanel === 'settings' ? null : 'settings') },
    { label: 'Show toolbar', checked: prefs.showToolbar, onSelect: () => update('showToolbar', !prefs.showToolbar) },
    { label: 'Scroll on type', checked: prefs.scrollOnType, onSelect: () => update('scrollOnType', !prefs.scrollOnType) },
    { label: 'Wrap lines', checked: prefs.wrapLines, onSelect: () => update('wrapLines', !prefs.wrapLines) },
    { label: 'Split views vertically', checked: prefs.splitVertical, onSelect: () => update('splitVertical', true) },
    { label: 'Split views horizontally', checked: !prefs.splitVertical, onSelect: () => update('splitVertical', false) },
    {
      label: 'Theme',
      submenu: [
        { label: 'Light', checked: prefs.theme === 'light', onSelect: () => update('theme', 'light') },
        { label: 'Dark', checked: prefs.theme === 'dark', onSelect: () => update('theme', 'dark') },
        { label: 'System', checked: prefs.theme === 'system', onSelect: () => update('theme', 'system') },
        { label: 'Invert preview', checked: prefs.invertPreview, onSelect: () => update('invertPreview', !prefs.invertPreview) },
      ],
    },
    { label: 'Only show editor', onSelect: () => update('showBothPanels', false) },
    { label: 'Show both panels', checked: prefs.showBothPanels, onSelect: () => update('showBothPanels', true) },
    { label: 'Present', pro: true, disabled: true },
    { label: 'Speaker mode', pro: true, disabled: true },
  ]

  const fileItems: MenuItem[] = [
    { label: 'New file…', shortcut: 'Ctrl-N', onSelect: () => setNewFileOpen(true) },
    { label: 'Rename project…', onSelect: () => setRenameOpen(true) },
    { label: 'Export PDF', onSelect: () => void onExportPdf() },
    { label: 'Export sources (ZIP)', onSelect: () => void onExportSources() },
    { label: 'Export SVG', onSelect: () => void onExportSvg() },
    { label: 'Export PNG', onSelect: () => void onExportPng() },
    { label: 'Delete project…', onSelect: () => setConfirmDelete(true) },
    { label: 'Close', onSelect: () => navigate('/') },
  ]

  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl-Z', onSelect: () => { const v = editorViewRef.current; if (v) undo(v) } },
    { label: 'Redo', shortcut: 'Ctrl-Y', onSelect: () => { const v = editorViewRef.current; if (v) redo(v) } },
    { label: 'Select all', shortcut: 'Ctrl-A', onSelect: () => { const v = editorViewRef.current; if (v) selectAll(v) } },
    { label: 'Find', shortcut: 'Ctrl-F', onSelect: () => { const v = editorViewRef.current; if (v) openSearchPanel(v) } },
  ]

  const helpItems: MenuItem[] = [
    { label: 'Typst documentation', onSelect: () => window.open('https://typst.app/docs/', '_blank', 'noopener,noreferrer') },
    { label: 'Compiler problems', checked: showDiagnostics, onSelect: () => setShowDiagnostics((v) => !v) },
    { label: 'Settings', onSelect: () => setActivePanel(activePanel === 'settings' ? null : 'settings') },
  ]

  const onRenameProject = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!record || !trimmed) return
    const next = { ...record, meta: { ...record.meta, name: trimmed, updatedAt: Date.now() } }
    setRecord(next)
    persist(next)
  }, [record, persist])

  const activeFile = record ? fileByPath(record.files, activeFilePath) : undefined

  const editorViewRef = useRef<EditorView | null>(null)
  const navRef = useRef<PreviewNavigator | null>(null)
  const cursorTimer = useRef<number | undefined>(undefined)
  const collabMgrRef = useRef<CollabManager | null>(null)
  const [collabSession, setCollabSession] = useState<CollabSession | null>(null)

  useEffect(() => {
    if (!id) return
    const mgr = new CollabManager(id)
    collabMgrRef.current = mgr
    return () => {
      void mgr.destroy()
      collabMgrRef.current = null
    }
  }, [id])

  useEffect(() => {
    const mgr = collabMgrRef.current
    if (!mgr || !record) return
    const file = fileByPath(record.files, activeFilePath)
    if (!file || file.kind !== 'source') {
      setCollabSession(null)
      return
    }
    let cancelled = false
    const session = mgr.sessionFor(activeFilePath, file.text ?? '')
    void session.ready.then(() => {
      if (!cancelled) setCollabSession(session)
    })
    return () => { cancelled = true }
  }, [activeFilePath, record, id])

  const wrapSelection = useCallback((before: string, after: string, placeholder: string) => {
    const view = editorViewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to) || placeholder
    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length + selected.length },
    })
    view.focus()
  }, [])

  const prefixLine = useCallback((prefix: string) => {
    const view = editorViewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    view.dispatch({ changes: { from: line.from, insert: prefix } })
    view.focus()
  }, [])

  const onEditorCursor = useCallback((offset: number) => {
    window.clearTimeout(cursorTimer.current)
    cursorTimer.current = window.setTimeout(() => {
      if (!prefs.scrollOnType) return
      if (!navRef.current || !activeFile || activeFile.kind !== 'source') return
      void navRef.current.scrollToSource(activeFilePath, activeFile.text ?? '', offset, { align: 'center', behavior: 'smooth' })
    }, 200)
  }, [activeFile, activeFilePath, prefs.scrollOnType])

  const onSourceJump = useCallback((path: string, line: number, column: number) => {
    const normalized = path.startsWith('/') ? path : '/' + path
    const jumpTo = () => {
      const view = editorViewRef.current
      if (!view) return
      const doc = view.state.doc
      let offset = 0
      try {
        offset = doc.line(Math.min(Math.max(1, line), doc.lines)).from + (column - 1)
      } catch {
        offset = 0
      }
      view.dispatch({ selection: { anchor: offset }, scrollIntoView: true })
      view.focus()
    }
    if (activeFilePath === normalized) {
      jumpTo()
    } else {
      setActiveFilePath(normalized)
      window.setTimeout(jumpTo, 0)
    }
  }, [activeFilePath])


  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => {
          const delta = e.deltaY > 0 ? -5 : 5
          return Math.max(25, Math.min(500, z + delta))
        })
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's' || e.key === 'S') {
          if (prefs.disableCtrlS) e.preventDefault()
          return
        }
        if (e.key === '=' || e.key === '+' || e.key === '-') {
          e.preventDefault()
          setZoom(z => {
            if (e.key === '-') return Math.max(25, z - 10)
            return Math.min(500, z + 10)
          })
        }
        if (e.key === '0') {
          e.preventDefault()
          setZoom(100)
        }
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [prefs.disableCtrlS])

  return (
    <div className="app-shell">
      <header className="topbar px-4 py-2 border-b border-line bg-topbar flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-fg-2 hover:text-fg" title="Back to dashboard" aria-label="Back to dashboard" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3 text-[13px] font-medium text-fg">
            <Link to="/" className="hover:text-white mr-1" style={{ textDecoration: 'none' }}>Typst</Link>
            <div style={{ position: 'relative' }}>
              <button className="hover:text-white" aria-haspopup="menu" aria-expanded={fileMenuOpen} onClick={() => setFileMenuOpen((v) => !v)}>File</button>
              {fileMenuOpen && <Menu items={fileItems} close={() => setFileMenuOpen(false)} />}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="hover:text-white" aria-haspopup="menu" aria-expanded={editMenuOpen} onClick={() => setEditMenuOpen((v) => !v)}>Edit</button>
              {editMenuOpen && <Menu items={editItems} close={() => setEditMenuOpen(false)} />}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="hover:text-white" aria-haspopup="menu" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen((v) => !v)}>View</button>
              {viewMenuOpen && <Menu items={viewItems} close={() => setViewMenuOpen(false)} />}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="hover:text-white" aria-haspopup="menu" aria-expanded={helpMenuOpen} onClick={() => setHelpMenuOpen((v) => !v)}>Help</button>
              {helpMenuOpen && <Menu items={helpItems} close={() => setHelpMenuOpen(false)} />}
            </div>
          </div>
        </div>
        
        <div className="flex items-center text-[13px] font-medium text-fg-2">
          <Cloud size={14} className="mr-2" />
          <button onClick={() => setActivePanel('settings')} title="Account — open settings" className="hover:text-fg">
            {email ?? 'Account'}
          </button>
          <span className="mx-1.5 text-line-2">›</span>
          <button onClick={() => setRenameOpen(true)} title="Rename project" className="hover:text-fg">
            {record?.meta.name ?? 'Untitled'}
          </button>
          <span className="mx-1.5 text-line-2">›</span>
          <span className="text-white font-semibold">{activeFilePath.replace(/^\//, '')}</span>
        </div>

        <div className="flex items-center gap-1.5 text-fg-2">
          <button aria-label="Undo" title="Undo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) undo(v) }}><Undo2 size={15} /></button>
          <button aria-label="Redo" title="Redo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) redo(v) }}><Redo2 size={15} /></button>
          <div className="w-px h-4 bg-line mx-1" />
          <button
            aria-label="Compiler problems"
            title="Compiler problems"
            className={`p-1 hover:bg-raised rounded ${showDiagnostics ? 'text-white' : 'text-fg'}`}
            onClick={() => setShowDiagnostics((v) => !v)}
          >
            <Terminal size={15} />
            {diagnostics.length > 0 && (
              <span
                aria-label={`${diagnostics.length} problems`}
                className="ml-1 rounded-full px-1 text-[10px] text-white"
                style={{ background: 'var(--danger-fill)' }}
              >
                {diagnostics.length}
              </span>
            )}
          </button>
          <div className="w-px h-4 bg-line mx-1" />
          <button aria-label="Zoom out" title="Zoom out" className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.max(25, z - 10))}><Minus size={15} /></button>
          <span className="text-xs w-10 text-center font-medium">{zoom}%</span>
          <button aria-label="Zoom in" title="Zoom in" className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.min(500, z + 10))}><Plus size={15} /></button>
          <div className="w-px h-4 bg-line mx-1" />
          <button
            aria-label="Toggle preview"
            title="Show/hide preview panel"
            className={`p-1 hover:bg-raised rounded ${prefs.showBothPanels ? 'text-fg' : 'text-fg-2'}`}
            onClick={() => update('showBothPanels', !prefs.showBothPanels)}
          >
            <Layout size={15} />
          </button>
          <button
            aria-label="Toggle file tree"
            title="Show/hide files panel"
            className={`p-1 hover:bg-raised rounded ${activePanel === 'files' ? 'text-fg' : 'text-fg-2'}`}
            onClick={() => setActivePanel(activePanel === 'files' ? null : 'files')}
          >
            <Book size={15} />
          </button>
          <div className="w-px h-4 bg-line mx-2" />
          <button
            onClick={onShareLink}
            className="flex items-center h-[26px] px-3 text-[13px] font-medium rounded border border-line bg-panel hover:bg-raised text-fg transition-colors"
          >
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            onClick={() => setExportPanelOpen((v) => !v)}
            aria-expanded={exportPanelOpen}
            aria-controls="export-panel"
            title="Export"
            className="flex items-center h-[26px] px-2 text-[13px] font-medium rounded border border-line bg-panel hover:bg-raised text-fg transition-colors gap-1"
          >
            <Download size={14} />
            <div className="w-px h-3 bg-line-2 mx-1"></div>
            <ChevronDown size={12} />
          </button>
        </div>
      </header>
      <div className="workbench">
        <aside className="activity-rail flex flex-col w-[48px] border-r border-line bg-topbar py-3 items-center gap-3 shrink-0">
          <button aria-label="Search" title="Search" className={`p-2 rounded text-fg-2 hover:text-fg ${searchOpen ? 'text-white' : ''}`} onClick={() => { const v = editorViewRef.current; if (v) { if (searchPanelOpen(v.state)) { closeSearchPanel(v); setSearchOpen(false) } else { openSearchPanel(v); setSearchOpen(true) } } }}>
            <Search size={18} />
          </button>
          <button aria-label="Outline" title="Outline" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'outline' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'outline' ? null : 'outline')}>
            <BookOpen size={18} />
          </button>
          <button aria-label="Packages" title="Packages" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'packages' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'packages' ? null : 'packages')}>
            <Package size={18} />
          </button>
          <button aria-label="Collaboration" title="Collaboration" className={`relative p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'globe' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'globe' ? null : 'globe')}>
            <Globe size={18} />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand-fill rounded-full border-[1.5px] border-topbar flex items-center justify-center text-[9px] text-white font-bold">5</span>
          </button>
          <button aria-label="Toggle settings panel" title="Settings" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'settings' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}>
            <Settings size={18} />
          </button>
          
          <div className="flex-1" />
          
          <button className="p-2 rounded text-fg-2 hover:text-fg">
            <Leaf size={18} />
          </button>
          <button className="p-2 rounded text-fg-2 hover:text-fg">
            <CircleHelp size={18} />
          </button>
          <div className="rail-wordmark" aria-hidden="true">typst</div>
        </aside>
        <main className="workspace-main">
          {!ready && (
            <div className="page-spinner-full">
              <Loader2 size={26} className="animate-spin" />
              <span className="sr-only">Preparing the Typst compiler</span>
            </div>
          )}
          {showDiagnostics && diagnostics.length > 0 && (
            <ul className="diagnostics-banner" aria-label="Compiler problems">
              {diagnostics.map((d, i) => (
                <li key={i}>
                  <button
                    className="flex w-full items-center gap-2 text-left"
                    onClick={() => {
                      if (!d.location) return
                      onSourceJump(d.location.file, d.location.line, d.location.column)
                      setShowDiagnostics(false)
                    }}
                    disabled={!d.location}
                  >
                    <TriangleAlert size={12} className="shrink-0" />
                    <span className="truncate">{d.message}</span>
                    {d.location && (
                      <span className="tnum shrink-0 opacity-70">
                        {d.location.file}:{d.location.line}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {prefs.showToolbar && (
          <div className="workspace-toolbar">
            <div className="formatting-tools" aria-label="Formatting toolbar">
              <button title="Text" aria-label="Insert text" onClick={() => wrapSelection('', '', 'Text')}>Ag</button>
              <button title="Bold" aria-label="Bold" onClick={() => wrapSelection('*', '*', 'bold text')}><strong>B</strong></button>
              <button title="Italic" aria-label="Italic" onClick={() => wrapSelection('_', '_', 'italic text')}><em>I</em></button>
              <button title="Underline" aria-label="Underline" onClick={() => wrapSelection('#underline[', ']', 'underlined')}><u>U</u></button>
              <span className="toolbar-divider" />
              <button title="Heading" aria-label="Heading" onClick={() => prefixLine('= ')}>H</button>
              <button title="Bulleted list" aria-label="Bulleted list" onClick={() => prefixLine('- ')}><List size={15} /></button>
              <button title="Numbered list" aria-label="Numbered list" onClick={() => prefixLine('+ ')}><ListOrdered size={15} /></button>
              <button title="Math block" aria-label="Math block" onClick={() => wrapSelection('$$\n', '\n$$', 'x^2 + y^2 = z^2')}><Sigma size={15} /></button>
              <button title="Code block" aria-label="Code block" onClick={() => wrapSelection('```typst\n', '\n```', '#let x = 1')}><Code size={15} /></button>
              <button title="Mention / reference" aria-label="Mention or reference" onClick={() => wrapSelection('@', '', 'figure-1')}><AtSign size={15} /></button>
            </div>
            <div className="preview-tools">
              <button
                className="icon-button"
                title="Recompile"
                aria-label="Recompile"
                onClick={() => { if (record) void runCompile(record.files) }}
              >
                {compiling ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
              </button>
              <button className="zoom-button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(25, value - 10))}><Minus size={14} /></button>
              <span className="tnum w-11 text-center">{zoom}%</span>
              <button className="zoom-button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(500, value + 10))}><Plus size={14} /></button>
              <button className="icon-button" title="Reset zoom to 100%" aria-label="Reset zoom to 100 percent" onClick={() => setZoom(100)}><Maximize2 size={14} /></button>
              <div className="menu-anchor">
                <button
                  className="download-button"
                  onClick={onExportPdf}
                  disabled={exporting || !ready}
                  title="Export PDF"
                  aria-label="Export PDF"
                >
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                <button
                  className="icon-button"
                  title="Export options"
                  aria-label="Export options"
                  aria-expanded={exportPanelOpen}
                  onClick={() => setExportPanelOpen((v) => !v)}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
          )}
          <div className="editor-workspace">
        {activePanel === 'files' && (
        <div className="file-panel">
          {record && (
            <FileTree
              files={record.files}
              activePath={activeFilePath}
              onOpenFile={setActiveFilePath}
              onNewFile={onNewFile}
              onRequestDeleteFile={(path) => setPendingDeleteFile(path)}
              onUploadAsset={onUploadAsset}
            />
          )}
        </div>
        )}
        {activePanel === 'settings' && (
          <SettingsPanel
            prefs={prefs}
            update={update}
            onRequestDelete={() => setConfirmDelete(true)}
            record={record}
            onRename={onRenameProject}
            onMoveFolder={onMoveFolder}
          />
        )}
        <SplitPane
          vertical={prefs.splitVertical}
          left={
            activeFile?.kind === 'source' ? (
              <TypstEditor
                engine={project.getEngine()!}
                doc={activeFile.text ?? ''}
                activePath={activeFilePath}
                onChange={onEditorChange}
                diagnostics={diagnostics}
                wrapLines={prefs.wrapLines}
                showLineNumbers={prefs.showLineNumbers}
                fontSize={prefs.fontSize}
                fontFamily={prefs.fontFamily}
                dark={prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)}
                vimMode={prefs.vimMode}
                writingDirection={prefs.writingDirection}
                externalViewRef={editorViewRef}
                onCursor={onEditorCursor}
                collab={collabSession}
              />
            ) : (
              <div className="p-4 text-sm text-fg-2">Select a .typ file to edit, or upload an asset.</div>
            )
          }
          right={prefs.showBothPanels ? <ErrorBoundary><div className={prefs.invertPreview ? 'invert-preview h-full' : 'h-full'}><div className="flex h-full"><div className="min-w-0 flex-1"><VirtualizedPreview pages={pages} compileSeq={compileSeq} renderPage={(i) => project.renderPage(i)} zoom={zoom} onZoomChange={setZoom} engine={project.getEngine()} navRef={navRef} onSourceJump={onSourceJump} /></div>{exportPanelOpen && <ExportPanel onExportPdf={onExportPdf} onExportSources={onExportSources} onExportSvg={onExportSvg} onExportPng={onExportPng} exportingFormat={exportingFormat} pageCount={pages.length} fileCount={record?.files.length ?? 0} />}</div></div></ErrorBoundary> : null}
        />
      </div>
        </main>
      </div>

      <PromptDialog
        open={shareUrl !== null}
        title="Copy your share link"
        description="Clipboard access was blocked. Select the link below to copy it."
        initialValue={shareUrl ?? ''}
        readOnly
        confirmLabel="Done"
        onCancel={() => setShareUrl(null)}
        onConfirm={() => setShareUrl(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete project?"
        description={record ? `"${record.meta.name}" and its files will be permanently deleted. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); void onDeleteProject() }}
      />
      <ConfirmDialog
        open={pendingDeleteFile !== null}
        title="Delete file?"
        description={pendingDeleteFile ? `${pendingDeleteFile} will be removed from this project.` : undefined}
        confirmLabel="Delete file"
        destructive
        onCancel={() => setPendingDeleteFile(null)}
        onConfirm={() => {
          const path = pendingDeleteFile
          setPendingDeleteFile(null)
          if (path) onDeleteFile(path)
        }}
      />
      <PromptDialog
        open={newFileOpen}
        title="New file"
        description="Enter the path for the new file, e.g. /chapters/intro.typ."
        placeholder="/chapters/intro.typ"
        confirmLabel="Create"
        onCancel={() => setNewFileOpen(false)}
        onConfirm={(value) => { setNewFileOpen(false); if (value.trim()) onNewFile(value) }}
      />
      <PromptDialog
        open={renameOpen}
        title="Rename project"
        description="Update this project's display name."
        initialValue={record?.meta.name ?? ''}
        confirmLabel="Rename"
        onCancel={() => setRenameOpen(false)}
        onConfirm={(value) => { setRenameOpen(false); void onRenameProject(value) }}
      />
    </div>
  )
}
