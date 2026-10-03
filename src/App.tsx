import { useCallback, useEffect, useRef, useState } from 'react'
import { Project } from './compiler/project'
import { loadFonts } from './storage/fontLoader'
import { TypstEditor } from './editor/TypstEditor'
import { VirtualizedPreview, type PageData } from './preview/VirtualizedPreview'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { SplitPane } from './components/SplitPane'
import { ErrorBoundary } from './components/ErrorBoundary'
import { loadProject, saveProject } from './storage/projectStore'
import type { Diagnostic } from 'typst-wasm'
import blank from './templates/blank.typ?raw'
import quarterly from './templates/quarterly-report.typ?raw'
import status from './templates/project-status.typ?raw'

const TEMPLATES = [
  { id: 'blank', label: 'Blank', source: blank },
  { id: 'quarterly', label: 'Quarterly Report', source: quarterly },
  { id: 'status', label: 'Project Status', source: status },
]

const project = new Project()

export default function App() {
  const [statusText, setStatusText] = useState('loading fonts…')
  const [source, setSource] = useState(TEMPLATES[0].source)
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0].id)
  const [pages, setPages] = useState<PageData[]>([])
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [lastCompileMs, setLastCompileMs] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const compileTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const runCompile = useCallback(async (src: string) => {
    const t0 = performance.now()
    const res = await project.compile(src)
    setLastCompileMs(Math.round(performance.now() - t0))
    if (res) {
      setPages(res.pages.map((p) => ({ page: p.page, width: p.width, height: p.height, svg: p.output })))
      setTotalPages(res.totalPages)
      setDiagnostics(res.diagnostics)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const fonts = await loadFonts()
        setStatusText('initializing compiler…')
        await project.init(fonts)
        const stored = await loadProject()
        const initial = stored?.source ?? TEMPLATES[0].source
        setSource(initial)
        setStatusText('ready')
        await runCompile(initial)
      } catch (e) {
        setStatusText('error: ' + (e as Error).message)
      }
    })()
  }, [runCompile])

  const onChange = useCallback((next: string) => {
    setSource(next)
    window.clearTimeout(compileTimer.current)
    compileTimer.current = window.setTimeout(() => runCompile(next), 150)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveProject({ id: 'default', name: 'untitled', source: next, updatedAt: Date.now() })
    }, 800)
  }, [runCompile])

  const onSelectTemplate = useCallback((id: string) => {
    const t = TEMPLATES.find((t) => t.id === id)
    if (!t) return
    setActiveTemplate(id)
    setSource(t.source)
    runCompile(t.source)
  }, [runCompile])

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveProject({ id: 'default', name: 'untitled', source, updatedAt: Date.now() })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        onExportPdf()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source, onExportPdf])

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        templates={TEMPLATES}
        activeTemplate={activeTemplate}
        onSelectTemplate={onSelectTemplate}
        onExportPdf={onExportPdf}
        status={statusText}
        exporting={exporting}
      />
      {diagnostics.length > 0 && (
        <div className="bg-red-950 text-red-200 text-xs px-3 py-1 truncate">
          {diagnostics[0].message}
        </div>
      )}
      <SplitPane
        left={<TypstEditor doc={source} onChange={onChange} diagnostics={diagnostics} />}
        right={<ErrorBoundary><VirtualizedPreview pages={pages} /></ErrorBoundary>}
      />
      <StatusBar totalPages={totalPages} diagnosticsCount={diagnostics.length} lastCompileMs={lastCompileMs} />
    </div>
  )
}
