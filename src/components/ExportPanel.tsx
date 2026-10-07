import { Loader2, FileText, FileArchive, Image as ImageIcon, FileCode2 } from 'lucide-react'

export type ExportFormat = 'pdf' | 'zip' | 'svg' | 'png'

interface Props {
  onExportPdf: () => void
  onExportSources: () => void
  onExportSvg: () => void
  onExportPng: () => void
  exportingFormat: ExportFormat | null
  pageCount: number
  fileCount: number
}

const OPTIONS = [
  { key: 'pdf' as const, label: 'Download PDF', Icon: FileText, needsPages: true, hint: 'Vector, selectable text' },
  { key: 'png' as const, label: 'Export PNG', Icon: ImageIcon, needsPages: true, hint: 'One image per page' },
  { key: 'svg' as const, label: 'Export SVG', Icon: FileCode2, needsPages: true, hint: 'One file per page' },
  { key: 'zip' as const, label: 'Download sources', Icon: FileArchive, needsPages: false, hint: 'Typst files and assets' },
]

export function ExportPanel({ onExportPdf, onExportSources, onExportSvg, onExportPng, exportingFormat, pageCount, fileCount }: Props) {
  const handlers: Record<ExportFormat, () => void> = {
    pdf: onExportPdf,
    zip: onExportSources,
    svg: onExportSvg,
    png: onExportPng,
  }

  return (
    <div id="export-panel" className="flex h-full w-[300px] flex-col border-l border-line bg-panel text-sm text-fg-2">
      <div className="border-b border-line px-4 py-3 font-semibold text-fg">Export</div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-raised p-3">
          <FileText size={18} className="shrink-0 text-fg-3" />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">
              {pageCount === 0 ? 'Nothing compiled yet' : `${pageCount} page${pageCount === 1 ? '' : 's'}`}
            </p>
            <p className="tnum text-xs text-fg-3">
              {pageCount === 0
                ? 'Compile the document to enable export'
                : `Documents over one page download as a zip · ${fileCount} file${fileCount === 1 ? '' : 's'} in this project`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {OPTIONS.map(({ key, label, Icon, needsPages, hint }) => {
            const busy = exportingFormat === key
            const blocked = needsPages ? pageCount === 0 : fileCount === 0
            const disabled = exportingFormat !== null || blocked
            return (
              <button
                key={key}
                type="button"
                onClick={handlers[key]}
                disabled={disabled}
                aria-busy={busy}
                className="flex items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-left transition-colors hover:border-accent hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line disabled:hover:bg-raised"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-fill/15 text-accent">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{busy ? 'Exporting…' : label}</span>
                  <span className="block truncate text-xs text-fg-3">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
