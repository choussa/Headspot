import { useCallback, useEffect, useRef, useState } from 'react'
import { Project } from './compiler/project'
import { loadFonts } from './storage/fontLoader'
import { TypstEditor } from './editor/TypstEditor'
import { VirtualizedPreview } from './preview/VirtualizedPreview'
import { SplitPane } from './components/SplitPane'
import { FileTree } from './components/FileTree'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  listProjects, loadProject, saveProject, deleteProject, migrateLegacy,
} from './storage/projectStore'
import {
  createProject, addFile, deleteFile, setFileText, addAsset, fileByPath,
  normalizePath, type ProjectRecord, type ProjectFile,
} from './state/workspace'
import type { Diagnostic, PageInfo } from '@vedivad/typst-web-service'
import blank from './templates/blank.typ?raw'
import { usePreferences } from './state/preferences'
import { Menu, type MenuItem } from './components/Menu'
import { SettingsPanel } from './components/SettingsPanel'
import {
  PanelLeft, Search, Map as MapIcon, PenLine, Settings, Sparkles, CircleHelp,
  Share2, Download, MoreHorizontal, ChevronLeft, Undo2, Redo2,
} from 'lucide-react'

const project = new Project()

export default function App() {
  const [record, setRecord] = useState<ProjectRecord | null>(null)
  const [activeFilePath, setActiveFilePath] = useState('/main.typ')
  const [pages, setPages] = useState<PageInfo[]>([])
  const [compileSeq, setCompileSeq] = useState(0)
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [exporting, setExporting] = useState(false)
  const [zoom, setZoom] = useState(75)
  const [activePanel, setActivePanel] = useState<'files' | 'settings' | null>('files')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { prefs, update } = usePreferences()
  const compileTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const runCompile = useCallback(async (files: ProjectFile[]) => {
    const res = await project.compileProject(files)
    if (res) {
      setPages(res.pages)
      setDiagnostics(res.diagnostics)
      setCompileSeq((n) => n + 1)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const fonts = await loadFonts()
        await project.init(fonts)

        const metas = await listProjects()
        let first = metas[0] ? await loadProject(metas[0].id) : await migrateLegacy()
        if (!first) {
          first = createProject('Untitled', blank)
          await saveProject(first)
        }
        setRecord(first)
        setActiveFilePath('/main.typ')
        await runCompile(first.files)
      } catch (e) {
        console.error('HeadSpot initialization failed', e)
      }
    })()
  }, [runCompile])

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
    const p = normalizePath(path.endsWith('.typ') ? path : path + '.typ')
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
    if (!confirm(`Delete project "${record.meta.name}"?`)) return
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
    setExporting(true)
    try {
      const pdf = await project.exportPdf()
      const blob = new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [])

  const exportItems: MenuItem[] = [
    { label: 'Export as PDF', onSelect: onExportPdf },
    { label: 'Export as PNG', disabled: true, onSelect: () => {} },
    { label: 'Export as SVG', disabled: true, onSelect: () => {} },
    { label: 'Export sources as ZIP', disabled: true, onSelect: () => {} },
  ]

  const viewItems: MenuItem[] = [
    { label: 'File panel', checked: activePanel === 'files', onSelect: () => setActivePanel(activePanel === 'files' ? null : 'files') },
    { label: 'Settings panel', checked: activePanel === 'settings', onSelect: () => setActivePanel(activePanel === 'settings' ? null : 'settings') },
    { label: 'Improve panel', checked: false, shortcut: 'Ctrl-Alt-3' },
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

  const activeFile = record ? fileByPath(record.files, activeFilePath) : undefined


  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => {
          const delta = e.deltaY > 0 ? -5 : 5
          return Math.max(50, Math.min(300, z + delta))
        })
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.key === '-') {
          e.preventDefault()
          setZoom(z => {
            if (e.key === '-') return Math.max(50, z - 10)
            return Math.min(300, z + 10)
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
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <ChevronLeft size={16} />
        <div className="brand-mark">typst</div>
        <nav className="topnav" aria-label="Application menu">
          <button>File</button>
          <button>Edit</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setViewMenuOpen((v) => !v)}>View</button>
            {viewMenuOpen && <Menu items={viewItems} close={() => setViewMenuOpen(false)} />}
          </div>
          <button>Help</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" title="Undo"><Undo2 size={15} /></button>
          <button className="icon-button" title="Redo"><Redo2 size={15} /></button>
          <button className="share-button"><Share2 size={13} /> Share</button>
          <button className="icon-button" title="More options"><MoreHorizontal size={16} /></button>
        </div>
      </header>
      <div className="workbench">
        <aside className="activity-rail" aria-label="Workspace navigation">
          <button className={`rail-button${activePanel === 'files' ? ' rail-active' : ''}`} title="Files" onClick={() => setActivePanel(activePanel === 'files' ? null : 'files')}><PanelLeft size={18} /></button>
          <button className="rail-button" title="Search"><Search size={18} /></button>
          <button className="rail-button" title="Outline"><MapIcon size={18} /></button>
          <button className="rail-button" title="Improve"><PenLine size={18} /><span className="notification">5</span></button>
          <div className="rail-spacer" />
          <button className={`rail-button${activePanel === 'settings' ? ' rail-active' : ''}`} title="Settings" onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}><Settings size={18} /></button>
          <button className="rail-button" title="Appearance"><Sparkles size={18} /></button>
          <button className="rail-button" title="Help"><CircleHelp size={18} /></button>
          <div className="rail-wordmark">typst</div>
        </aside>
        <main className="workspace-main">
          {prefs.showToolbar && (
          <div className="workspace-toolbar">
            <div className="formatting-tools" aria-label="Formatting toolbar">
              <button title="Text style">Ag</button>
              <button title="Bold"><strong>B</strong></button>
              <button title="Italic"><em>I</em></button>
              <button title="Underline"><u>U</u></button>
              <span className="toolbar-divider" />
              <button title="Heading">H</button>
              <button title="Bulleted list">☷</button>
              <button title="Numbered list">≣</button>
              <button title="Math">Σ</button>
              <button title="Code">&lt;/&gt;</button>
              <button title="Mention">@</button>
            </div>
            <div className="preview-tools">
              <button className="icon-button" title="Refresh preview">↻</button>
              <button className="zoom-button" onClick={() => setZoom((value) => Math.max(50, value - 5))}>−</button>
              <span>{zoom}%</span>
              <button className="zoom-button" onClick={() => setZoom((value) => Math.min(125, value + 5))}>+</button>
              <button className="icon-button" title="Focus preview">▣</button>
              <div className="menu-anchor">
                <button className="download-button" onClick={onExportPdf} disabled={exporting} title="Export PDF">{exporting ? '…' : <Download size={14} />}</button>
                <button className="icon-button" title="Export menu" onClick={() => setExportMenuOpen((v) => !v)}>▾</button>
                {exportMenuOpen && <Menu items={exportItems} close={() => setExportMenuOpen(false)} />}
              </div>
            </div>
          </div>
          )}
      {diagnostics.length > 0 && (
        <div className="diagnostics-banner">
          {diagnostics[0].location?.file ? `[${diagnostics[0].location.file}] ` : ''}{diagnostics[0].message}
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
              onDeleteFile={onDeleteFile}
              onUploadAsset={onUploadAsset}
            />
          )}
        </div>
        )}
        {activePanel === 'settings' && (
          <SettingsPanel prefs={prefs} update={update} onDeleteProject={onDeleteProject} />
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
              />
            ) : (
              <div className="p-4 text-neutral-500 text-sm">Select a .typ file to edit, or upload an asset.</div>
            )
          }
          right={prefs.showBothPanels ? <ErrorBoundary><div className={prefs.invertPreview ? 'invert-preview h-full' : 'h-full'}><VirtualizedPreview pages={pages} compileSeq={compileSeq} renderPage={(i) => project.renderPage(i)} zoom={zoom} onZoomChange={setZoom} /></div></ErrorBoundary> : null}
        />
      </div>
        </main>
      </div>
    </div>
  )
}
