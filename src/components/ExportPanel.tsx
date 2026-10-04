import { Download, Loader2, FileText } from 'lucide-react'

interface Props {
  onExportPdf: () => void
  exporting: boolean
  pageCount: number
}

export function ExportPanel({ onExportPdf, exporting, pageCount }: Props) {
  return (
    <div className="flex h-full w-[300px] flex-col border-l border-line bg-panel text-sm text-fg-2">
      <div className="border-b border-line px-4 py-3 font-semibold text-fg">Export</div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-raised p-3">
          <FileText size={18} className="shrink-0 text-fg-3" />
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">PDF</p>
            <p className="tnum text-xs text-fg-3">
              {pageCount === 0
                ? 'No pages compiled yet'
                : `${pageCount} page${pageCount === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={exporting || pageCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-fill px-3 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-45"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exporting…' : 'Download PDF'}
        </button>

        <p className="mt-4 text-xs leading-relaxed text-fg-3">
          This compiler build exports PDF only. PNG, SVG, and project archive
          export are not available.
        </p>
      </div>
    </div>
  )
}
