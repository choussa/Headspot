import { useEffect, useRef } from 'react'
import { minimalSetup } from 'codemirror'
import { EditorView, lineNumbers } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  typstHighlighting,
  typstTheme,
  defaultDarkTheme,
  defaultLightTheme,
  createTypstCompileSync,
  typstFilePath,
  createTypstHover,
  typstCompletionSource,
} from '@vedivad/codemirror-typst'
import { autocompletion } from '@codemirror/autocomplete'
import { lintGutter } from '@codemirror/lint'
import { search } from '@codemirror/search'
import { vim } from '@replit/codemirror-vim'
import { pushDiagnostics } from './diagnostics'
import type { Diagnostic, TypstProject } from '@vedivad/typst-web-service'
import type { MutableRefObject } from 'react'
import { yCollab } from 'y-codemirror.next'
import type { CollabSession } from './collab'
import { commentHighlights, setCommentRanges } from './comments'

interface Props {
  engine: TypstProject
  doc: string
  activePath: string
  onChange: (source: string) => void
  diagnostics: Diagnostic[]
  wrapLines?: boolean
  showLineNumbers?: boolean
  fontSize?: number
  fontFamily?: string
  dark?: boolean
  vimMode?: boolean
  writingDirection?: 'ltr' | 'rtl'
  spellcheck?: boolean
  externalViewRef?: MutableRefObject<EditorView | null>
  onCursor?: (offset: number) => void
  collab?: CollabSession | null
  commentRanges?: { from: number; to: number }[]
}

export function TypstEditor({ engine, doc, activePath, onChange, diagnostics, wrapLines = true, showLineNumbers = true, fontSize = 15, fontFamily = '"Cascadia Mono", monospace', dark = true, vimMode = false, writingDirection = 'ltr', spellcheck = false, externalViewRef, onCursor, collab, commentRanges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const projectRef = useRef<TypstProject | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCursorRef = useRef(onCursor)
  onCursorRef.current = onCursor
  const pathCompartment = useRef(new Compartment())
  const wrapCompartment = useRef(new Compartment())
  const gutterCompartment = useRef(new Compartment())
  const fontCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const vimCompartment = useRef(new Compartment())
  const collabCompartment = useRef(new Compartment())

  useEffect(() => {
    let view: EditorView | null = null
    let timer: number | undefined

    {
      const project = engine
      projectRef.current = project

      view = new EditorView({
        parent: containerRef.current!,
        state: EditorState.create({
          doc,
          extensions: [
            minimalSetup,
            themeCompartment.current.of(
              dark
                ? [oneDark, typstTheme(defaultDarkTheme)]
                : [typstTheme(defaultLightTheme)],
            ),
            gutterCompartment.current.of(showLineNumbers ? lineNumbers() : []),
            wrapCompartment.current.of(wrapLines ? EditorView.lineWrapping : []),
            fontCompartment.current.of(
              EditorView.theme({
                '&': { height: '100%', fontSize: `${fontSize}px` },
                '.cm-scroller': { fontFamily },
              }),
            ),
            pathCompartment.current.of(typstFilePath.of(activePath)),
            vimCompartment.current.of(vimMode ? vim({ status: true }) : []),
            collabCompartment.current.of([]),
            commentHighlights(),
            typstHighlighting({ project }),
            createTypstCompileSync({ project }),
            createTypstHover({ project }),
            autocompletion({ override: [typstCompletionSource({ project })] }),
            lintGutter(),
            search(),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) {
                window.clearTimeout(timer)
                timer = window.setTimeout(() => onChangeRef.current(u.state.doc.toString()), 150)
              }
              if (u.selectionSet) {
                onCursorRef.current?.(u.state.selection.main.head)
              }
            }),
          ],
        }),
      })
      viewRef.current = view
      if (externalViewRef) externalViewRef.current = view
    }

    return () => {
      window.clearTimeout(timer)
      view?.destroy()
      if (externalViewRef) externalViewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const activeCollab = collab && collab.path === activePath ? collab : null
    if (activeCollab) {
      const text = activeCollab.ytext.toString()
      if (view.state.doc.toString() !== text) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      }
    } else if (view.state.doc.toString() !== doc) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } })
    }
    projectRef.current?.setText(activePath, activeCollab ? activeCollab.ytext.toString() : doc)
    viewRef.current?.dispatch({ effects: pathCompartment.current.reconfigure(typstFilePath.of(activePath)) })
  }, [doc, activePath, collab])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const activeCollab = collab && collab.path === activePath ? collab : null
    if (activeCollab) {
      const ytext = activeCollab.ytext.toString()
      const current = view.state.doc.toString()
      if (!activeCollab.hasRemoteState()) {
        if (ytext !== current) {
          activeCollab.ydoc.transact(() => {
            if (activeCollab.ytext.length > 0) activeCollab.ytext.delete(0, activeCollab.ytext.length)
            if (current.length > 0) activeCollab.ytext.insert(0, current)
          }, 'local-sync')
        }
      } else if (ytext !== current) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: ytext } })
      }
    }
    view.dispatch({
      effects: collabCompartment.current.reconfigure(
        activeCollab ? yCollab(activeCollab.ytext, activeCollab.awareness, { undoManager: false }) : [],
      ),
    })
  }, [collab, activePath])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        wrapCompartment.current.reconfigure(wrapLines ? EditorView.lineWrapping : []),
        gutterCompartment.current.reconfigure(showLineNumbers ? lineNumbers() : []),
        themeCompartment.current.reconfigure(
          dark
            ? [oneDark, typstTheme(defaultDarkTheme)]
            : [typstTheme(defaultLightTheme)],
        ),
        fontCompartment.current.reconfigure(
          EditorView.theme({
            '&': { height: '100%', fontSize: `${fontSize}px` },
            '.cm-scroller': { fontFamily },
          }),
        ),
      ],
    })
  }, [wrapLines, showLineNumbers, fontSize, fontFamily, dark])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: vimCompartment.current.reconfigure(vimMode ? vim({ status: true }) : []),
    })
  }, [vimMode])

  useEffect(() => {
    const view = viewRef.current
    if (view) view.contentDOM.spellcheck = spellcheck
  }, [spellcheck])

  useEffect(() => {
    const view = viewRef.current
    if (view) view.dispatch({ effects: setCommentRanges.of(commentRanges ?? []) })
  }, [commentRanges])

  useEffect(() => {
    if (viewRef.current) pushDiagnostics(viewRef.current, diagnostics, activePath)
  }, [diagnostics, activePath])

  return <div ref={containerRef} dir={writingDirection} className="h-full overflow-auto" />
}
