import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  TypstProject,
  typstHighlighting,
  typstTheme,
  defaultDarkTheme,
  createTypstCompileSync,
  typstFilePath,
  createTypstHover,
  typstCompletionSource,
} from '@vedivad/codemirror-typst'
import { autocompletion } from '@codemirror/autocomplete'
import { lintGutter } from '@codemirror/lint'
import { pushDiagnostics } from './diagnostics'
import type { Diagnostic } from 'typst-wasm'

interface Props {
  doc: string
  onChange: (source: string) => void
  diagnostics: Diagnostic[]
}

export function TypstEditor({ doc, onChange, diagnostics }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const projectRef = useRef<TypstProject | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let destroyed = false
    let view: EditorView | null = null
    let timer: number | undefined

    ;(async () => {
      const project = await TypstProject.create()
      if (destroyed) return
      projectRef.current = project
      await project.setText('/main.typ', doc)

      view = new EditorView({
        parent: containerRef.current!,
        state: EditorState.create({
          doc,
          extensions: [
            basicSetup,
            oneDark,
            typstTheme(defaultDarkTheme),
            typstFilePath.of('/main.typ'),
            typstHighlighting({ project }),
            createTypstCompileSync({ project }),
            createTypstHover({ project }),
            autocompletion({ override: [typstCompletionSource({ project })] }),
            lintGutter(),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) {
                window.clearTimeout(timer)
                timer = window.setTimeout(() => onChangeRef.current(u.state.doc.toString()), 150)
              }
            }),
            EditorView.theme({ '&': { height: '100%' } }),
          ],
        }),
      })
      viewRef.current = view
    })()

    return () => {
      destroyed = true
      window.clearTimeout(timer)
      view?.destroy()
      projectRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== doc) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } })
    }
  }, [doc])

  useEffect(() => {
    if (viewRef.current) pushDiagnostics(viewRef.current, diagnostics)
  }, [diagnostics])

  return <div ref={containerRef} className="h-full overflow-auto" />
}
