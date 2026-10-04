import { useState } from 'react'
import { ChevronDown, ChevronRight, Download, HelpCircle } from 'lucide-react'

const PDF_STANDARDS = ['PDF/A-1b', 'PDF/A-1a', 'PDF/A-2b', 'PDF/A-2u', 'PDF/A-2a', 'PDF/A-3b', 'PDF/A-3u', 'PDF/A-3a', 'PDF/A-4', 'PDF/A-4f', 'PDF/A-4e', 'PDF/UA-1']

interface Props {
  onExportPdf: () => void
  exporting: boolean
}

function Section({ title, open, setOpen, children }: { title: string; open: boolean; setOpen: (open: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-800">
      <button className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-neutral-900" onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}</span>
        <Download size={14} className="text-neutral-500" />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export function ExportPanel({ onExportPdf, exporting }: Props) {
  const [openPdf, setOpenPdf] = useState(true)
  const [openPng, setOpenPng] = useState(false)
  const [openSvg, setOpenSvg] = useState(false)
  const [standard, setStandard] = useState<string | null>(null)
  const [tagged, setTagged] = useState(true)
  const [pretty, setPretty] = useState(false)

  return (
    <div className="flex h-full w-[300px] flex-col border-l border-neutral-800 bg-neutral-950 text-sm text-neutral-300">
      <div className="border-b border-neutral-800 px-4 py-3 font-semibold text-white">Export &amp; Preview</div>

      <div className="flex-1 overflow-auto">
        <Section title="PDF" open={openPdf} setOpen={setOpenPdf}>
          <div className="mb-4 flex items-center justify-between text-neutral-400">
            <span className="italic">Previewed</span>
            <button className="italic hover:text-white" onClick={onExportPdf} disabled={exporting}>{exporting ? '…' : 'Export'} <Download size={13} className="inline" /></button>
          </div>

          <label className="mb-1 flex items-center gap-1 text-xs text-neutral-500">Page range</label>
          <select className="mb-3 w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm">
            <option>All pages</option>
            <option>Current page</option>
            <option>Custom…</option>
          </select>

          <label className="mb-1 flex items-center gap-1 text-xs text-neutral-500">PDF version <HelpCircle size={11} /></label>
          <select className="mb-3 w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm">
            <option>Automatic (PDF 1.7)</option>
            <option>PDF 1.4</option>
            <option>PDF 1.5</option>
            <option>PDF 1.6</option>
          </select>

          <label className="mb-1 flex items-center gap-1 text-xs text-neutral-500">PDF standard <HelpCircle size={11} /></label>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {PDF_STANDARDS.map((s) => (
              <button
                key={s}
                onClick={() => setStandard(standard === s ? null : s)}
                className={`rounded-full border px-1 py-1 text-[10px] ${standard === s ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'}`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={tagged} onChange={(e) => setTagged(e.target.checked)} /> Tagged PDF <HelpCircle size={11} className="text-neutral-600" />
          </label>
          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} /> Pretty-print <HelpCircle size={11} className="text-neutral-600" />
          </label>
        </Section>

        <Section title="PNG" open={openPng} setOpen={setOpenPng}>
          <label className="mb-2 flex items-center gap-2"><input type="checkbox" /> Export pages as PNG images</label>
          <select className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5"><option>All pages</option></select>
        </Section>

        <Section title="SVG" open={openSvg} setOpen={setOpenSvg}>
          <label className="mb-2 flex items-center gap-2"><input type="checkbox" /> Export pages as SVG</label>
          <select className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5"><option>All pages</option></select>
        </Section>

        <Section title="HTML" open={false} setOpen={() => {}}>
          <div className="text-neutral-500">HTML export is not available for this engine.</div>
        </Section>

        <Section title="Project archive" open={false} setOpen={() => {}}>
          <button className="rounded-md border border-neutral-800 px-3 py-1.5 hover:bg-neutral-900">Download .zip</button>
        </Section>
      </div>
    </div>
  )
}
