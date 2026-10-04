import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

old_run = """        setPages(res.pages)
        setDiagnostics(res.diagnostics)
        setCompileSeq((n) => n + 1)
      }
    } finally {"""

new_run = """        setPages(res.pages)
        setDiagnostics(res.diagnostics)
        setCompileSeq((n) => n + 1)
        if (res.pages.length > 0) {
          project.renderPage(0).then(svg => {
            if (svg) {
              setRecord(prev => {
                if (!prev) return prev
                if (prev.meta.thumbnail === svg) return prev
                const next = { ...prev, meta: { ...prev.meta, thumbnail: svg } }
                saveProject(next)
                return next
              })
            }
          })
        }
      }
    } finally {"""

code = code.replace(old_run, new_run)

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
