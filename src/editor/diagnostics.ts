import { setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import type { Diagnostic } from '@vedivad/typst-web-service'
import type { EditorView } from '@codemirror/view'

export function toCmDiagnostics(view: EditorView, diagnostics: Diagnostic[], activeFilePath = '/main.typ'): CmDiagnostic[] {
  const norm = (p?: string) => (p ? (p.startsWith('/') ? p : '/' + p) : '/main.typ')
  const docLen = view.state.doc.length
  const out: CmDiagnostic[] = []
  for (const d of diagnostics) {
    if (norm(d.location?.file) !== activeFilePath) continue
    const from = Math.min(Math.max(d.location?.start ?? 0, 0), docLen)
    const to = Math.min(Math.max(d.location?.end ?? from, from), docLen)
    out.push({
      from,
      to: Math.max(to, from),
      severity: d.severity === 'warning' ? 'warning' : 'error',
      message: d.message,
      source: 'typst',
    })
  }
  return out
}

export function pushDiagnostics(view: EditorView, diagnostics: Diagnostic[], activeFilePath = '/main.typ') {
  view.dispatch(setDiagnostics(view.state, toCmDiagnostics(view, diagnostics, activeFilePath)))
}
