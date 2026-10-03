import { setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import type { Diagnostic } from 'typst-wasm'
import type { EditorView } from '@codemirror/view'

export function toCmDiagnostics(view: EditorView, diagnostics: Diagnostic[]): CmDiagnostic[] {
  const docLen = view.state.doc.length
  const out: CmDiagnostic[] = []
  for (const d of diagnostics) {
    const from = Math.min(Math.max(d.start ?? 0, 0), docLen)
    const to = Math.min(Math.max(d.end ?? from, from), docLen)
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

export function pushDiagnostics(view: EditorView, diagnostics: Diagnostic[]) {
  view.dispatch(setDiagnostics(view.state, toCmDiagnostics(view, diagnostics)))
}
