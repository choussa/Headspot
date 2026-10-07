
import { useParams, useNavigate, Link } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { parse as parseToml } from 'smol-toml'
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
  listProjects, loadProject, saveProject, deleteProject, moveProject,
} from '../storage/cloudStore'
import {
  createProject, addFile, deleteFile, setFileText, addAsset, fileByPath,
  normalizePath, type ProjectRecord, type ProjectFile,
} from '../state/workspace'
import type { Diagnostic, PageInfo, PreviewNavigator } from '@vedivad/typst-web-service'
import type { EditorView } from '@codemirror/view'
import { undo, redo, selectAll } from '@codemirror/commands'
import { FindReplace } from '../components/FindReplace'
import blank from '../templates/blank.typ?raw'
import { usePreferences } from '../state/preferences'
import { supabase } from '../lib/supabase'
import { Menu, type MenuItem } from '../components/Menu'
import { SettingsPanel } from '../components/SettingsPanel'
import { OutlinePanel } from '../components/OutlinePanel'
import { HistoryPanel } from '../components/HistoryPanel'
import { CopilotPanel } from '../components/CopilotPanel'
import { takeSnapshot, type Snapshot } from '../storage/history'
import { listComments, saveComments, fetchComments, putComment, removeCommentRow, type ProjectComment } from '../storage/comments'
import { CommentPopover, type PopoverAnchor } from '../components/CommentPopover'
import { CommentsPanel } from '../components/CommentsPanel'
import { TomlPackageForm } from '../components/TomlPackageForm'
import { SnippetsPalette, ShortcutsDialog } from '../components/SnippetsPalette'
import { ExportPanel } from '../components/ExportPanel'
import { ConfirmDialog, PromptDialog } from '../components/Dialogs'
import {
  ArrowLeft, Search, Settings, Download, Undo2, Redo2, Loader2,
  Minus, Plus, ChevronDown, List, ListOrdered, Sigma, Code, AtSign, FormInput,
  TriangleAlert,
  BookOpen, Package, CircleHelp, Cloud, Layout, Book, Files, MessageSquarePlus
} from 'lucide-react'

const project = new Project()

// On-demand overlays are split out so they don't load with the editor shell.
const PresentationMode = lazy(() => import('../components/PresentationMode').then((m) => ({ default: m.PresentationMode })))
const PackageSettings = lazy(() => import('../components/PackageSettings').then((m) => ({ default: m.PackageSettings })))

type ExportFormat = 'pdf' | 'zip' | 'svg' | 'png'

/** Filesystem-safe download name derived from the project title. */
function baseName(name: string | null | undefined): string {
  const slug = (name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'document'
}

/** Escape text before interpolating it into generated HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  const [zoom, setZoom] = useState(75)
  const [ready, setReady] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const lastPanelRef = useRef<string | null>(null)
  useEffect(() => {
    if (activePanel) lastPanelRef.current = activePanel
  }, [activePanel])
  const shownPanel = activePanel ?? lastPanelRef.current
  const PANEL_WIDTH = 280
  const [findOpen, setFindOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [popover, setPopover] = useState<{ commentId: string | null; range: { from: number; to: number }; anchor: PopoverAnchor } | null>(null)
  const [selAnchor, setSelAnchor] = useState<PopoverAnchor | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [packageViewOpen, setPackageViewOpen] = useState(false)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [assetQueue, setAssetQueue] = useState<{ name: string; data: Uint8Array }[]>([])
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null)
      const uid = data.session?.user.id ?? null
      setUserId(uid)
      userIdRef.current = uid
    })
  }, [])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingDeleteFile, setPendingDeleteFile] = useState<string | null>(null)
  const { prefs, update } = usePreferences()
  const compileTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const thumbAt = useRef(0)

  const runCompile = useCallback(async (files: ProjectFile[]) => {
    setCompiling(true)
    try {
      const r = recordRef.current
      const res = await project.compileProject(files, r ? { ownerId: userIdRef.current, packageConfig: r.meta.packageConfig } : undefined)
      if (res) {
        setPages(res.pages)
        // Surface manifest (typst.toml) syntax problems in the Improve panel too.
        const extra: Diagnostic[] = []
        const toml = files.find((f) => f.path.endsWith('typst.toml'))
        if (toml?.text) {
          try {
            parseToml(toml.text)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            const lm = /line (\d+)/i.exec(msg)
            const line = lm ? parseInt(lm[1], 10) : 1
            const start = toml.text.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0)
            extra.push({
              severity: 'error',
              message: `typst.toml: ${msg}`,
              hints: [],
              location: { file: 'typst.toml', start, end: start, line, column: 1 },
            })
          }
        }
        setDiagnostics([...res.diagnostics, ...extra])
        setCompileSeq((n) => n + 1)
        setStale(false)
        if (res.pages.length > 0) {
          const now = Date.now()
          if (now - thumbAt.current > 15_000) {
            thumbAt.current = now
            const p0 = res.pages[0]
            void project.renderPage(0).then(async (svg) => {
              if (!svg) return
              let thumb: string
              try {
                const blob = await svgToPngBlob(svg, p0.width, p0.height, 1)
                thumb = await new Promise<string>((resolve, reject) => {
                  const fr = new FileReader()
                  fr.onload = () => resolve(String(fr.result))
                  fr.onerror = () => reject(new Error('thumb read failed'))
                  fr.readAsDataURL(blob)
                })
              } catch {
                thumb = svg // fall back to raw svg
              }
              setRecord(prev => {
                if (!prev) return prev
                if (prev.meta.thumbnail === thumb) return prev
                const next = { ...prev, meta: { ...prev.meta, thumbnail: thumb } }
                saveProject(next)
                return next
              })
            })
          }
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
        for (const f of loaded.files) {
          if (f.kind === 'asset' && f.data && /\.(ttf|otf|ttc)$/i.test(f.path)) {
            await project.addFonts([f.data.slice().buffer as ArrayBuffer])
          }
        }
        await runCompile(loaded.files)
      } else {
        navigate('/')
      }
    })()
  }, [id, ready, runCompile, navigate])

  const persist = useCallback((rec: ProjectRecord) => {
    window.clearTimeout(saveTimer.current)
    setSaveState(navigator.onLine ? 'saving' : 'offline')
    saveTimer.current = window.setTimeout(() => {
      void saveProject(rec)
        .then(() => setSaveState(navigator.onLine ? 'saved' : 'offline'))
        .catch(() => setSaveState(navigator.onLine ? 'error' : 'offline'))
    }, 600)
  }, [])

  // Flush any pending debounced save when the page hides/unloads or the route changes.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = undefined
        const r = recordRef.current
        if (r) void saveProject(r).catch(() => undefined)
      }
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      setSaveState('saving')
      // Give the offline flush queued in main.tsx a moment, then reflect the result.
      window.setTimeout(() => setSaveState(navigator.onLine ? 'saved' : 'offline'), 1500)
    }
    const onOffline = () => setSaveState('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
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
    setStale(true)
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
    if (/\.(ttf|otf|ttc)$/i.test(path)) {
      void project.addFonts([data.slice().buffer as ArrayBuffer])
    }
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
    { label: 'Version history', checked: activePanel === 'history', onSelect: () => setActivePanel(activePanel === 'history' ? null : 'history') },
    { label: 'Copilot assistant', checked: activePanel === 'copilot', onSelect: () => setActivePanel(activePanel === 'copilot' ? null : 'copilot') },
    { label: 'Comments', checked: activePanel === 'comments', onSelect: () => setActivePanel(activePanel === 'comments' ? null : 'comments') },
    { label: 'Improve', checked: activePanel === 'improve', onSelect: () => setActivePanel(activePanel === 'improve' ? null : 'improve') },
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
    { label: 'Present', onSelect: () => setPresenting(true) },
    { label: 'Speaker mode', pro: true, disabled: true },
  ]

  const fileItems: MenuItem[] = [
    { label: 'New file…', shortcut: 'Ctrl-N', onSelect: () => setNewFileOpen(true) },
    { label: 'Rename project…', onSelect: () => setRenameOpen(true) },
    { label: 'Export PDF', onSelect: () => void onExportPdf() },
    { label: 'Export sources (ZIP)', onSelect: () => void onExportSources() },
    { label: 'Export SVG', onSelect: () => void onExportSvg() },
    { label: 'Export PNG', onSelect: () => void onExportPng() },
    { label: 'Publish to web', onSelect: () => void onPublish() },
    { label: 'Package settings…', onSelect: () => setPackageViewOpen(true) },
    { label: 'Delete project…', onSelect: () => setConfirmDelete(true) },
    { label: 'Close', onSelect: () => navigate('/') },
  ]

  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl-Z', onSelect: () => { const v = editorViewRef.current; if (v) undo(v) } },
    { label: 'Redo', shortcut: 'Ctrl-Y', onSelect: () => { const v = editorViewRef.current; if (v) redo(v) } },
    { label: 'Select all', shortcut: 'Ctrl-A', onSelect: () => { const v = editorViewRef.current; if (v) selectAll(v) } },
    { label: 'Find', shortcut: 'Ctrl-F', onSelect: () => setFindOpen(true) },
    { label: 'Snippets…', shortcut: 'Ctrl-Space', onSelect: () => setSnippetsOpen(true) },
  ]

  const helpItems: MenuItem[] = [
    { label: 'Typst documentation', onSelect: () => window.open('https://typst.app/docs/', '_blank', 'noopener,noreferrer') },
    { label: 'Keyboard shortcuts', onSelect: () => setShortcutsOpen(true) },
    { label: 'Snippets palette', shortcut: 'Ctrl-Space', onSelect: () => setSnippetsOpen(true) },
    { label: 'Compiler problems', checked: activePanel === 'improve', onSelect: () => setActivePanel(activePanel === 'improve' ? null : 'improve') },
    { label: 'Settings', onSelect: () => setActivePanel(activePanel === 'settings' ? null : 'settings') },
  ]

  const onRenameProject = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!record || !trimmed) return
    const next = { ...record, meta: { ...record.meta, name: trimmed, updatedAt: Date.now() } }
    setRecord(next)
    persist(next)
  }, [record, persist])

  const onMoveFolder = useCallback(async (folderId: string | null) => {
    if (!record) return
    await moveProject(record.meta.id, folderId)
    const next = { ...record, meta: { ...record.meta, folderId } }
    setRecord(next)
    persist(next)
  }, [record, persist])

  useEffect(() => {
    if (!ready) return
    project.setEntry(prefs.previewedFile || '/main.typ')
  }, [prefs.previewedFile, ready])

  const onRestoreSnapshot = useCallback((snap: Snapshot) => {
    const prev = recordRef.current
    // Snapshots don't carry asset bytes — re-attach them from the live record.
    const files = prev
      ? snap.files.map((sf) => {
          if (sf.kind === 'asset' && !sf.data) {
            const cur = fileByPath(prev.files, sf.path)
            if (cur?.data) return { ...sf, data: cur.data }
          }
          return sf
        })
      : snap.files
    if (prev) {
      const next = { ...prev, files }
      persist(next)
      setRecord(next)
    }
    setActiveFilePath('/main.typ')
    void runCompile(files)
  }, [persist, runCompile])

  const onCopilotInsert = useCallback((code: string) => {
    const v = editorViewRef.current
    if (v) {
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: code } })
      v.focus()
      return
    }
    const r = recordRef.current
    if (r) {
      const f = fileByPath(r.files, activeFilePath)
      if (f && f.kind === 'source') updateFiles(setFileText(r.files, activeFilePath, (f.text ?? '') + '\n' + code))
    }
  }, [activeFilePath, updateFiles])

  const onPublish = useCallback(async () => {
    if (!record) return
    const res = await project.compileProject(record.files, { ownerId: userIdRef.current, packageConfig: record.meta.packageConfig })
    if (!res || res.pages.length === 0) return
    const svgs = await Promise.all(res.pages.map((_, i) => project.renderPage(i)))
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(record.meta.name)}</title><style>body{margin:0;background:#444;display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px}svg{background:#fff;max-width:100%;height:auto;box-shadow:0 4px 24px rgba(0,0,0,.4)}</style></head><body>${svgs.filter(Boolean).join('\n')}</body></html>`
    const { error } = await supabase.storage.from('project-assets').upload(`published/${record.meta.id}/index.html`, new Blob([html], { type: 'text/html' }), { upsert: true, contentType: 'text/html' })
    if (error) {
      console.error('Publish failed', error)
      return
    }
    const { data } = supabase.storage.from('project-assets').getPublicUrl(`published/${record.meta.id}/index.html`)
    setPublishedUrl(data.publicUrl)
  }, [record])

  const activeFile = record ? fileByPath(record.files, activeFilePath) : undefined

  // Stable renderer so memoized preview pages don't refetch on every parent render.
  const renderPage = useCallback((i: number) => project.renderPage(i), [])

  const persistComments = useCallback((next: ProjectComment[]) => {
    const r = recordRef.current
    if (!r) return
    setComments(next)
    saveComments(r.meta.id, next)
  }, [])

  const anchorFor = useCallback((from: number, to: number): PopoverAnchor | null => {
    const v = editorViewRef.current
    if (!v) return null
    const a = v.coordsAtPos(from)
    const b = v.coordsAtPos(to)
    if (!a) return null
    const bottom = Math.max(a.bottom, b?.bottom ?? a.bottom)
    const top = Math.min(a.top, b?.top ?? a.top)
    const left = Math.min(a.left, b?.left ?? a.left)
    const spaceBelow = window.innerHeight - bottom
    const above = spaceBelow < 280 && top > spaceBelow
    const x = Math.max(12, Math.min(left, window.innerWidth - 316))
    const y = above ? Math.max(12, top - 8) : Math.min(bottom + 8, window.innerHeight - 12)
    return { x, y, above }
  }, [])

  const openPopoverFor = useCallback((commentId: string, from: number, to: number) => {
    const a = anchorFor(from, to)
    if (!a) return
    setPopover({ commentId, range: { from, to }, anchor: a })
  }, [anchorFor])

  const onAddComment = useCallback((text: string) => {
    const r = recordRef.current
    if (!r || !text.trim()) return
    const v = editorViewRef.current
    const sel = v?.state.selection.main
    const from = sel?.from ?? 0
    const to = sel?.to ?? from
    const c: ProjectComment = { id: crypto.randomUUID(), path: activeFilePath, from, to, text: text.trim(), author: email?.split('@')[0] ?? 'You', ts: Date.now(), resolved: false, replies: [] }
    persistComments([...comments, c])
    void putComment(r.meta.id, c)
    openPopoverFor(c.id, from, to)
  }, [comments, activeFilePath, email, persistComments, openPopoverFor])

  const onChangeComment = useCallback((c: ProjectComment) => {
    const r = recordRef.current
    if (!r) return
    persistComments(comments.map((x) => (x.id === c.id ? c : x)))
    void putComment(r.meta.id, c)
  }, [comments, persistComments])

  const onResolveComment = useCallback((id: string) => {
    const r = recordRef.current
    if (!r) return
    const target = comments.find((c) => c.id === id)
    if (!target) return
    const next = { ...target, resolved: !target.resolved }
    persistComments(comments.map((c) => (c.id === id ? next : c)))
    void putComment(r.meta.id, next)
  }, [comments, persistComments])

  const onDeleteComment = useCallback((id: string) => {
    const r = recordRef.current
    if (!r) return
    persistComments(comments.filter((c) => c.id !== id))
    void removeCommentRow(id)
    setPopover((p) => (p?.commentId === id ? null : p))
  }, [comments, persistComments])


  const editorViewRef = useRef<EditorView | null>(null)
  const recordRef = useRef(record)
  recordRef.current = record
  const activeFilePathRef = useRef(activeFilePath)
  activeFilePathRef.current = activeFilePath
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
    const r = recordRef.current
    if (!mgr || !r) return
    const file = fileByPath(r.files, activeFilePath)
    if (!file || file.kind !== 'source') {
      setCollabSession(null)
      return
    }
    setCollabSession((prev) => (prev && prev.path === activeFilePath ? prev : null))
    let cancelled = false
    const session = mgr.sessionFor(activeFilePath, file.text ?? '')
    void session.ready.then(() => {
      if (!cancelled && session.path === activeFilePathRef.current) setCollabSession(session)
    })
    return () => { cancelled = true }
  }, [activeFilePath, record, id])

  // Presence: poll the awareness state of the active session for collaborator avatars.
  useEffect(() => {
    if (!collabSession) { setPresence([]); return }
    const read = () => {
      const states = collabSession.awareness.getStates()
      const out: { name: string; color: string }[] = []
      for (const [clientId, state] of states) {
        if (clientId === collabSession.awareness.doc.clientID) continue
        const u = state?.user as { name?: string; color?: string } | undefined
        if (u?.name) out.push({ name: u.name, color: u.color ?? '#8e4ec6' })
      }
      setPresence(out)
    }
    read()
    const t = window.setInterval(read, 3000)
    return () => window.clearInterval(t)
  }, [collabSession])

  // Bookmarks are per-project lines in the outline panel.
  const setBookmark = useCallback((lines: number[]) => {
    setBookmarks(lines)
    try { localStorage.setItem(`typst:bookmarks:${recordRef.current?.meta.id ?? ''}`, JSON.stringify(lines)) } catch { /* ignore */ }
  }, [])

  // Drag-and-drop file move (from the file tree).
  const onMoveFile = useCallback((fromPath: string, toFolder: string) => {
    const r = recordRef.current
    if (!r) return
    const oldPath = normalizePath(fromPath)
    if (oldPath === '/main.typ') return
    const name = oldPath.slice(oldPath.lastIndexOf('/') + 1)
    const folder = toFolder === '/' ? '' : toFolder.replace(/\/+$/, '')
    const newPath = normalizePath(folder + '/' + name)
    if (newPath === oldPath || fileByPath(r.files, newPath)) return
    const files = r.files.map((f) => (f.path === oldPath ? { ...f, path: newPath } : f))
    const next = { ...r, files }
    setRecord(next)
    persist(next)
    if (activeFilePathRef.current === oldPath) setActiveFilePath(newPath)
    setComments((prev) => {
      const changed = prev.some((c) => c.path === oldPath)
      if (!changed) return prev
      const moved = prev.map((c) => (c.path === oldPath ? { ...c, path: newPath } : c))
      if (r) saveComments(r.meta.id, moved)
      return moved
    })
    void runCompile(files)
  }, [persist, runCompile])

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

  const insertImage = useCallback((name: string) => {
    const snippet = `#image("/assets/${name}")\n`
    const view = editorViewRef.current
    if (!view) {
      setRecord((prev) => {
        if (!prev) return prev
        const f = fileByPath(prev.files, activeFilePath)
        if (!f || f.kind !== 'source') return prev
        const next = { ...prev, files: setFileText(prev.files, activeFilePath, (f.text ?? '') + '\n' + snippet) }
        persist(next)
        return next
      })
      return
    }
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: snippet }, selection: { anchor: from + snippet.length } })
    view.focus()
  }, [activeFilePath, persist])

  const handleDocDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const list = Array.from(e.dataTransfer.files)
    const next: { name: string; data: Uint8Array }[] = []
    for (const f of list) {
      const isImage = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name)
      if (!isImage) continue
      next.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })
    }
    if (next.length) setAssetQueue((q) => [...q, ...next])
  }, [])

  const confirmAsset = useCallback((value: string) => {
    const item = assetQueue[0]
    setAssetQueue((q) => q.slice(1))
    if (!item) return
    const safe = (value.trim() || item.name).replace(/[/\\]/g, '-')
    onUploadAsset(`/assets/${safe}`, item.data)
    insertImage(safe)
  }, [assetQueue, onUploadAsset, insertImage])

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  const [currentSelection, setCurrentSelection] = useState('')
  const [tomlMode, setTomlMode] = useState<'form' | 'code'>('form')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved')
  const [stale, setStale] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [presence, setPresence] = useState<{ name: string; color: string }[]>([])
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(`typst:bookmarks:${id ?? ''}`) ?? '[]') as number[] } catch { return [] }
  })

  useEffect(() => {
    const pid = record?.meta.id
    if (!pid) return
    let cancelled = false
    void (async () => {
      const remote = await fetchComments(pid)
      if (cancelled) return
      if (remote === null) {
        setComments(listComments(pid))
        return
      }
      if (remote.length === 0) {
        const local = listComments(pid)
        if (local.length > 0) {
          setComments(local)
          await Promise.all(local.map((c) => putComment(pid, c)))
          return
        }
      }
      setComments(remote)
    })()
    return () => { cancelled = true }
  }, [record?.meta.id])

  useEffect(() => {
    setPopover(null)
    setSelAnchor(null)
  }, [activeFilePath])

  useEffect(() => {
    if (popover?.commentId && !comments.some((c) => c.id === popover.commentId)) setPopover(null)
  }, [comments, popover])

  useEffect(() => {
    const view = editorViewRef.current
    if (!view || activeFile?.kind !== 'source') return
    const dom = view.dom
    const onClick = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element) || !t.closest('.cm-comment-anchor')) return
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null) return
      const c = comments.find((c) => c.path === activeFilePath && !c.resolved && pos >= c.from && pos <= c.to)
      if (c) openPopoverFor(c.id, c.from, c.to)
    }
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [comments, activeFilePath, activeFile?.kind, openPopoverFor])

  useEffect(() => {
    if (!popover) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && (t.closest('.comment-popover') || t.closest('.cm-comment-anchor'))) return
      setPopover(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null) }
    const onScroll = () => setPopover(null)
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [popover])

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

  const onJumpComment = useCallback((path: string, from: number) => {
    const v = editorViewRef.current
    let line = 1
    if (v && path === activeFilePath) {
      try { line = v.state.doc.lineAt(from).number } catch { line = 1 }
    }
    onSourceJump(path, line, 1)
  }, [activeFilePath, onSourceJump])

  useEffect(() => {
    if (!record) return
    const id = window.setInterval(() => {
      const r = recordRef.current
      if (r) takeSnapshot(r.meta.id, r.files)
    }, 10 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [record?.meta.id])

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
        if ((e.key === 's' || e.key === 'S') && prefs.disableCtrlS) {
          e.preventDefault()
          const r = recordRef.current
          if (r) {
            takeSnapshot(r.meta.id, r.files)
            persist(r)
          }
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
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault()
        setSnippetsOpen((v) => !v)
      }
      if (e.key === 'Escape' && snippetsOpen) setSnippetsOpen(false)
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [prefs.disableCtrlS, snippetsOpen])

  return (
    <div className="app-shell">
      <header className="topbar px-4 py-2 border-b border-line bg-topbar flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-4">
            <button className="text-fg-2 hover:text-fg" title="Back to dashboard" aria-label="Back to dashboard" onClick={() => navigate('/')}>
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-3 text-[13px] font-medium text-fg">
              <Link to="/" className="hover:text-accent mr-1 no-underline">Typst</Link>
              <div className="menu-anchor">
                <button className="hover:text-accent" aria-haspopup="menu" aria-expanded={fileMenuOpen} onClick={() => setFileMenuOpen((v) => !v)}>File</button>
                {fileMenuOpen && <Menu items={fileItems} close={() => setFileMenuOpen(false)} />}
              </div>
              <div className="menu-anchor">
                <button className="hover:text-accent" aria-haspopup="menu" aria-expanded={editMenuOpen} onClick={() => setEditMenuOpen((v) => !v)}>Edit</button>
                {editMenuOpen && <Menu items={editItems} close={() => setEditMenuOpen(false)} />}
              </div>
              <div className="menu-anchor">
                <button className="hover:text-accent" aria-haspopup="menu" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen((v) => !v)}>View</button>
                {viewMenuOpen && <Menu items={viewItems} close={() => setViewMenuOpen(false)} />}
              </div>
              <div className="menu-anchor">
                <button className="hover:text-accent" aria-haspopup="menu" aria-expanded={helpMenuOpen} onClick={() => setHelpMenuOpen((v) => !v)}>Help</button>
                {helpMenuOpen && <Menu items={helpItems} close={() => setHelpMenuOpen(false)} />}
              </div>
            </div>
          </div>
          {prefs.showToolbar && (
            <div role="toolbar" aria-label="Formatting toolbar" className="flex items-center gap-1 ml-[32px] min-w-0 overflow-x-auto">
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Text" aria-label="Insert text" onClick={() => wrapSelection('', '', 'Text')}>Ag</button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Bold" aria-label="Bold" onClick={() => wrapSelection('*', '*', 'bold text')}><strong>B</strong></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Italic" aria-label="Italic" onClick={() => wrapSelection('_', '_', 'italic text')}><em>I</em></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Underline" aria-label="Underline" onClick={() => wrapSelection('#underline[', ']', 'underlined')}><u>U</u></button>
              <div className="w-px h-4 bg-line mx-0.5" />
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Heading" aria-label="Heading" onClick={() => prefixLine('= ')}>H</button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Bulleted list" aria-label="Bulleted list" onClick={() => prefixLine('- ')}><List size={14} /></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Numbered list" aria-label="Numbered list" onClick={() => prefixLine('+ ')}><ListOrdered size={14} /></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Math block" aria-label="Math block" onClick={() => wrapSelection('$$\n', '\n$$', 'x^2 + y^2 = z^2')}><Sigma size={14} /></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Code block" aria-label="Code block" onClick={() => wrapSelection('```typst\n', '\n```', '#let x = 1')}><Code size={14} /></button>
              <button className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center bg-panel border border-line rounded text-fg hover:bg-raised" title="Mention / reference" aria-label="Mention or reference" onClick={() => wrapSelection('@', '', 'figure-1')}><AtSign size={14} /></button>
            </div>
          )}
        </div>
        
        <div className="flex items-center min-w-0 text-[13px] font-medium text-fg-2">
          <Cloud size={14} className="mr-2 shrink-0" />
          <button onClick={() => setActivePanel('settings')} title="Account — open settings" className="hover:text-fg hidden truncate max-w-[140px] sm:inline">
            {email ?? 'Account'}
          </button>
          <span className="mx-1.5 text-line-2 hidden sm:inline">›</span>
          <button onClick={() => setRenameOpen(true)} title="Rename project" className="hover:text-fg truncate max-w-[160px]">
            {record?.meta.name ?? 'Untitled'}
          </button>
          <span className="mx-1.5 text-line-2">›</span>
          <span className="text-fg font-semibold truncate">{activeFilePath.replace(/^\//, '')}</span>
        </div>

        <div className="flex items-center gap-2 text-fg-2">
          {presence.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-1" title={presence.map((p) => p.name).join(', ')}>
              {presence.slice(0, 4).map((p) => (
                <span
                  key={p.name + p.color}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-topbar"
                  style={{ background: p.color }}
                  aria-label={`${p.name} is editing`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-fg-3 min-w-[110px] justify-end">
            {saveState === 'offline' && <span className="text-warning">Offline — queued</span>}
            {saveState === 'error' && <span className="text-danger">Save failed</span>}
            {saveState === 'saving' && navigator.onLine && <>Saving…</>}
            {saveState === 'saved' && navigator.onLine && stale && <>Uncompiled changes</>}
            {saveState === 'saved' && !stale && !compiling && <span className="text-fg-3">Saved</span>}
            {compiling && <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Compiling…</>}
            {!compiling && ready && diagnostics.length > 0 && <span className="text-danger">{diagnostics.length} problem{diagnostics.length === 1 ? '' : 's'}</span>}
          </span>
          <div className="flex items-center bg-panel border border-line rounded-md p-[3px] gap-[2px]">
            <button aria-label="Undo" title="Undo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) undo(v) }}><Undo2 size={15} /></button>
            <button aria-label="Redo" title="Redo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) redo(v) }}><Redo2 size={15} /></button>
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
          </div>
          
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
        <aside aria-label="Activity bar" className="activity-rail flex flex-col w-[48px] border-r border-line bg-topbar py-3 items-center gap-3 shrink-0">
          <button aria-label="Files" title="Files" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'files' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'files' ? null : 'files')}>
            <Files size={18} />
          </button>
          <button aria-label="Search" title="Find & replace" className={`p-2 rounded text-fg-2 hover:text-fg ${findOpen ? 'rail-active' : ''}`} onClick={() => setFindOpen((v) => !v)}>
            <Search size={18} />
          </button>
          <button aria-label="Outline" title="Outline" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'outline' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'outline' ? null : 'outline')}>
            <BookOpen size={18} />
          </button>
          <button aria-label="Packages" title="Package & template settings" className={`p-2 rounded text-fg-2 hover:text-fg ${packageViewOpen ? 'rail-active' : ''}`} onClick={() => setPackageViewOpen((v) => !v)}>
            <Package size={18} />
          </button>

          <div className="flex-1" />

          <button aria-label="Help" title="Typst documentation" className="p-2 rounded text-fg-2 hover:text-fg" onClick={() => window.open('https://typst.app/docs/', '_blank', 'noopener,noreferrer')}>
            <CircleHelp size={18} />
          </button>
          <button aria-label="Improve" title="Improve" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'improve' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'improve' ? null : 'improve')}>
            <TriangleAlert size={18} />
            {diagnostics.length > 0 && <span className="ml-1 rounded-full px-1 text-[10px] text-white bg-danger-fill">{diagnostics.length}</span>}
          </button>
          <button aria-label="Toggle settings panel" title="Settings" className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'settings' ? 'rail-active' : ''}`} onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}>
            <Settings size={18} />
          </button>
        </aside>
        <main className="workspace-main">
          {!ready && (
            <div className="page-spinner-full" role="status" aria-live="polite">
              <Loader2 size={26} className="animate-spin" aria-hidden="true" />
              <span className="sr-only">Preparing the Typst compiler</span>
            </div>
          )}
          <div className="editor-workspace" style={{ gridTemplateColumns: `${activePanel ? PANEL_WIDTH : 0}px minmax(0, 1fr)` }}>
        <div className="side-panel-host" aria-hidden={!activePanel} inert={!activePanel}>
        {shownPanel === 'files' && (
        <div className="file-panel">
          {record && (
            <FileTree
              files={record.files}
              activePath={activeFilePath}
              onOpenFile={setActiveFilePath}
              onNewFile={onNewFile}
              onRequestDeleteFile={(path) => setPendingDeleteFile(path)}
              onUploadAsset={onUploadAsset}
              onMoveFile={onMoveFile}
            />
          )}
        </div>
        )}
        {shownPanel === 'outline' && activeFile && activeFile.kind === 'source' && (
          <ErrorBoundary label="Outline failed.">
            <OutlinePanel
              source={activeFile.text ?? ''}
              onJump={(line) => onSourceJump(activeFilePath, line, 1)}
              bookmarks={bookmarks}
              onToggleBookmark={(line) => setBookmark(bookmarks.includes(line) ? bookmarks.filter((b) => b !== line) : [...bookmarks, line])}
            />
          </ErrorBoundary>
        )}
        {shownPanel === 'history' && record && (
          <ErrorBoundary label="Version history failed.">
            <HistoryPanel
              projectId={record.meta.id}
              currentMainText={fileByPath(record.files, '/main.typ')?.text ?? ''}
              onRestore={onRestoreSnapshot}
            />
          </ErrorBoundary>
        )}
        {shownPanel === 'comments' && (
          <ErrorBoundary label="Comments failed.">
            <CommentsPanel
              comments={comments}
              activePath={activeFilePath}
              currentSelection={currentSelection}
              onAdd={onAddComment}
              onJump={onJumpComment}
              onResolve={onResolveComment}
              onDelete={onDeleteComment}
            />
          </ErrorBoundary>
        )}
        {shownPanel === 'copilot' && (
          <ErrorBoundary label="Copilot failed.">
            <CopilotPanel onInsert={onCopilotInsert} getSelection={() => { const v = editorViewRef.current; return v ? v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to) : '' }} />
          </ErrorBoundary>
        )}
        {shownPanel === 'improve' && (
          <div className="file-panel">
            <div className="h-full flex flex-col text-sm bg-panel">
              <div className="file-panel-header">Improve</div>
              <div className="flex-1 overflow-auto p-2">
                {diagnostics.length === 0 ? (
                  <p className="text-xs text-fg-3 p-1">No problems found.</p>
                ) : (
                  <ul aria-label="Compiler problems">
                    {diagnostics.map((d, i) => (
                      <li key={i}>
                        <button
                          className="flex w-full items-center gap-2 text-left text-xs py-1"
                          onClick={() => {
                            if (!d.location) return
                            onSourceJump(d.location.file, d.location.line, d.location.column)
                          }}
                          disabled={!d.location}
                        >
                          <TriangleAlert size={12} className="shrink-0" />
                          <span className="truncate">{d.message}</span>
                          {d.location && <span className="tnum shrink-0 opacity-70">{d.location.file}:{d.location.line}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
        {shownPanel === 'settings' && (
          <ErrorBoundary label="Settings failed.">
            <SettingsPanel
              prefs={prefs}
              update={update}
              onRequestDelete={() => setConfirmDelete(true)}
              record={record}
              onRename={onRenameProject}
              onMoveFolder={onMoveFolder}
            />
          </ErrorBoundary>
        )}
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDocDrop}
          className="flex min-w-0 min-h-0 flex-1 flex-col"
        >
        <SplitPane
          vertical={prefs.splitVertical}
          left={
            !ready || !project.getEngine() ? (
              <div className="flex h-full items-center justify-center gap-2 p-4 text-sm text-fg-3" role="status">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Preparing the editor…
              </div>
            ) : activeFile?.kind === 'source' ? (
              activeFilePath.replace(/^\/+/, '').endsWith('typst.toml') && tomlMode === 'form' ? (
                <div className="relative h-full">
                  <TomlPackageForm
                    key={activeFilePath}
                    text={activeFile.text ?? ''}
                    sourceFiles={record?.files.filter((f) => f.kind === 'source') ?? []}
                    onChange={(toml, cfg) => {
                      setRecord((prev) => {
                        if (!prev) return prev
                        const next = {
                          ...prev,
                          files: setFileText(prev.files, activeFilePath, toml),
                          meta: cfg ? { ...prev.meta, packageConfig: cfg } : prev.meta,
                        }
                        persist(next)
                        return next
                      })
                    }}
                  />
                  <button
                    className="absolute top-2 right-2 p-1.5 rounded border border-line bg-panel text-fg-2 hover:text-fg hover:bg-raised"
                    title="Edit as code"
                    aria-label="Edit as code"
                    onClick={() => setTomlMode('code')}
                  >
                    <Code size={14} />
                  </button>
                </div>
              ) : (
              <div className="relative h-full">
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
                  spellcheck={prefs.spellcheck}
                  commentRanges={comments.filter((c) => c.path === activeFilePath && !c.resolved).map((c) => ({ from: c.from, to: c.to }))}
                  externalViewRef={editorViewRef}
                  onCursor={(offset) => {
                    onEditorCursor(offset)
                    const v = editorViewRef.current
                    if (v) {
                      const { from, to } = v.state.selection.main
                      setCurrentSelection(v.state.sliceDoc(from, to))
                      setSelAnchor(from !== to && activeFile?.kind === 'source' ? anchorFor(from, to) : null)
                    }
                  }}
                  collab={collabSession}
                  onFind={() => setFindOpen(true)}
                />
                <FindReplace viewRef={editorViewRef} open={findOpen} onClose={() => setFindOpen(false)} />
                {activeFilePath.replace(/^\/+/, '').endsWith('typst.toml') && (
                  <button
                    className="absolute top-2 right-2 p-1.5 rounded border border-line bg-panel text-fg-2 hover:text-fg hover:bg-raised z-10"
                    title="Edit as form"
                    aria-label="Edit as form"
                    onClick={() => setTomlMode('form')}
                  >
                    <FormInput size={14} />
                  </button>
                )}
              </div>
              )
            ) : record === null ? (
              <div className="flex h-full flex-col gap-3 p-4" role="status" aria-live="polite">
                <span className="sr-only">Loading project…</span>
                <div className="h-4 w-1/3 animate-pulse rounded bg-raised" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-raised" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-raised" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-raised" />
              </div>
            ) : (
              <div className="p-4 text-sm text-fg-2">Select a .typ file to edit, or upload an asset.</div>
            )
          }
          right={prefs.showBothPanels ? <ErrorBoundary><div className={prefs.invertPreview ? 'invert-preview h-full' : 'h-full'}><div className="flex h-full"><div className="min-w-0 flex-1"><VirtualizedPreview pages={pages} compileSeq={compileSeq} renderPage={renderPage} zoom={zoom} onZoomChange={setZoom} engine={project.getEngine()} navRef={navRef} onSourceJump={onSourceJump} compiling={compiling} hasErrors={diagnostics.length > 0} /></div>{exportPanelOpen && <ExportPanel onExportPdf={onExportPdf} onExportSources={onExportSources} onExportSvg={onExportSvg} onExportPng={onExportPng} exportingFormat={exportingFormat} pageCount={pages.length} fileCount={record?.files.length ?? 0} />}</div></div></ErrorBoundary> : null}
        />
        </div>
      </div>
        </main>
      </div>

      {presenting && (
        <Suspense fallback={null}>
          <PresentationMode pages={pages} renderPage={renderPage} onExit={() => setPresenting(false)} />
        </Suspense>
      )}

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

      <PromptDialog
        open={publishedUrl !== null}
        title="Published"
        description="Your document is published as a view-only HTML page."
        initialValue={publishedUrl ?? ''}
        readOnly
        confirmLabel="Done"
        onCancel={() => setPublishedUrl(null)}
        onConfirm={() => setPublishedUrl(null)}
      />

      <PromptDialog
        key={assetQueue.length + ':' + (assetQueue[0]?.name ?? '')}
        open={assetQueue.length > 0}
        title="Name asset"
        description="Set a filename for the dropped image before adding it to your project."
        initialValue={assetQueue[0]?.name ?? ''}
        confirmLabel="Add"
        cancelLabel="Discard"
        onCancel={() => setAssetQueue([])}
        onConfirm={confirmAsset}
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

      {packageViewOpen && record && (
        <Suspense fallback={null}>
        <PackageSettings
          record={record}
          ownerId={userId}
          onClose={() => setPackageViewOpen(false)}
          onUpdateConfig={(cfg) => {
            const r = recordRef.current
            if (!r) return
            const next = { ...r, meta: { ...r.meta, packageConfig: cfg } }
            setRecord(next)
            persist(next)
          }}
        />
        </Suspense>
      )}

      {selAnchor && !popover && activeFile?.kind === 'source' && (
        <button
          className="fixed z-40 p-1.5 rounded-md border border-brand bg-panel text-brand shadow-lg hover:bg-raised"
          style={{ left: selAnchor.x, top: selAnchor.y }}
          title="Add comment"
          aria-label="Add comment"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const v = editorViewRef.current
            if (!v) return
            const { from, to } = v.state.selection.main
            if (from === to) return
            setSelAnchor(null)
            setPopover({ commentId: null, range: { from, to }, anchor: selAnchor })
          }}
        >
          <MessageSquarePlus size={14} />
        </button>
      )}

      {(() => {
        if (!popover) return null
        const c = popover.commentId ? comments.find((x) => x.id === popover.commentId) ?? null : null
        const pos = c ? { from: c.from, to: c.to } : popover.range
        if (!pos) return null
        return (
          <CommentPopover
            comment={c}
            line={(() => { try { return editorViewRef.current?.state.doc.lineAt(pos.from).number ?? 1 } catch { return 1 } })()}
            anchor={popover.anchor}
            me={email?.split('@')[0] ?? 'You'}
            onClose={() => setPopover(null)}
            onCreate={(text) => {
              const r = recordRef.current
              if (!r || !text.trim()) return
              const nc: ProjectComment = { id: crypto.randomUUID(), path: activeFilePath, from: pos.from, to: pos.to, text: text.trim(), author: email?.split('@')[0] ?? 'You', ts: Date.now(), resolved: false, replies: [] }
              persistComments([...comments, nc])
              void putComment(r.meta.id, nc)
              setPopover((p) => (p ? { ...p, commentId: nc.id } : p))
            }}
            onChange={onChangeComment}
            onDelete={onDeleteComment}
            onJump={(from) => onJumpComment(c?.path ?? activeFilePath, from)}
          />
        )
      })()}

      <SnippetsPalette
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        onInsert={(text) => onCopilotInsert(text)}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
