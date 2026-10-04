import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    code = f.read()

# Fix the dynamic import of cloudStore since we already statically import it
old_rename = """  function renameProject(project: ProjectMeta) {
    const name = prompt('Rename project', project.name)?.trim()
    if (!name) return
    // cloudStore keeps name in the record; a full rename requires load/save round-trip
    import('../storage/cloudStore').then(async ({ loadProject, saveProject }) => {
      const rec = await loadProject(project.id)
      if (!rec) return
      rec.meta.name = name
      await saveProject(rec)
      load()
    })
  }"""

new_rename = """  function renameProject(project: ProjectMeta) {
    const name = prompt('Rename project', project.name)?.trim()
    if (!name) return
    
    // Use the statically imported cloudStore methods
    ;(async () => {
      const { loadProject, saveProject } = await import('../storage/cloudStore')
      const rec = await loadProject(project.id)
      if (!rec) return
      rec.meta.name = name
      await saveProject(rec)
      load()
    })()
  }"""

# Actually, we can just use the already imported methods, wait, we don't import loadProject and saveProject at the top?
# Let's check imports
