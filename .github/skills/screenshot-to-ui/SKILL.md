---
name: screenshot-to-ui
description: 'Transform screenshots or visual references into polished UI in this workspace. Use for screenshot-to-code, UI reconstruction, visual redesign, and frontend UX matching tasks.'
argument-hint: '[screenshots or visual references]'
user-invocable: true
---

# Screenshot To UI

Turn a screenshot or visual reference into a working interface while preserving the product's behavior and local conventions.

## When To Use

- Reconstruct a screen from screenshots or product references.
- Redesign an existing frontend to match a visual direction.
- Translate a reference application's layout, hierarchy, and interaction patterns into this workspace.

## Procedure

1. **Locate the owning surface.** Read the entry component, its stylesheet, the package scripts, and the nearest reusable components. Identify the smallest component boundary that controls the requested screen.
2. **Decompose the reference.** Record the page frame, navigation model, major regions, spacing rhythm, typography, color roles, controls, responsive behavior, and visible states. Separate visual signals from behavior that must remain functional.
3. **Form a local hypothesis.** State which existing path should own the change and one cheap check that could disconfirm it, such as a build, focused test, or browser render.
4. **Preserve behavior.** Keep existing data flow, callbacks, persistence, compiler/API integration, and accessibility semantics unless the reference explicitly requires a behavior change.
5. **Implement the smallest coherent slice.** Match the reference's hierarchy first, then typography, colors, borders, density, and motion. Prefer existing libraries and patterns. Avoid placeholder UI that hides missing functionality.
6. **Check responsive states.** Verify desktop and narrow layouts. Look specifically for clipped text, overlapping controls, unstable fixed-format regions, and split panes that become unusable.
7. **Validate behavior and visuals.** Run the narrowest available build/test/lint command immediately after the first edit. Start the dev server when needed and inspect the result in a browser at representative viewports.
8. **Finish with a concise handoff.** Report changed files, preserved behavior, validation performed, and any remaining visual uncertainty or asset gap.

## Quality Bar

- The interface has a clear visual system rather than a collection of unrelated styles.
- The screenshot's primary hierarchy and information density are recognizable at a glance.
- Controls have meaningful states and do not exist only as decoration.
- Existing workflows still work, including loading, editing, compiling, previewing, and exporting where applicable.
- Text fits its containers on desktop and mobile.
- No unrelated refactors or generated metadata are introduced.
