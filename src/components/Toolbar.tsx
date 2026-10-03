interface Props {
  templates: { id: string; label: string }[]
  activeTemplate: string
  onSelectTemplate: (id: string) => void
  onExportPdf: () => void
  status: string
  exporting: boolean
}

export function Toolbar({ templates, activeTemplate, onSelectTemplate, onExportPdf, status, exporting }: Props) {
  return (
    <div className="flex items-center gap-3 p-2 border-b bg-neutral-900 text-neutral-100 text-sm">
      <span className="font-semibold">HeadSpot</span>
      <select
        className="bg-neutral-800 rounded px-2 py-1"
        value={activeTemplate}
        onChange={(e) => onSelectTemplate(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <button
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-3 py-1"
        onClick={onExportPdf}
        disabled={exporting}
      >
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
      <span className="ml-auto text-neutral-400">{status}</span>
    </div>
  )
}
