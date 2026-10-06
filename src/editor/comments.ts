import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

export interface CommentRange { from: number; to: number }

export const setCommentRanges = StateEffect.define<CommentRange[]>()

const commentField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setCommentRanges)) {
        const ranges = e.value
          .filter((r) => r.to > r.from)
          .map((r) => Decoration.mark({ class: 'cm-comment-anchor' }).range(r.from, Math.min(r.to, tr.state.doc.length)))
        value = Decoration.set(ranges, true)
      }
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

export function commentHighlights(): Extension {
  return commentField
}
