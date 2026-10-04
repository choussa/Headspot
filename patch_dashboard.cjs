const fs = require('fs')

let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8')

if (!code.includes('loadProject, saveProject')) {
    code = code.replace("import { listProjects, createNewCloudProject, deleteProject } from '../storage/cloudStore'", "import { listProjects, createNewCloudProject, deleteProject, loadProject, saveProject } from '../storage/cloudStore'")
}

const oldRename = `    import('../storage/cloudStore').then(async ({ loadProject, saveProject }) => {
      const rec = await loadProject(project.id)
      if (!rec) return
      rec.meta.name = name
      await saveProject(rec)
      load()
    })`

const newRename = `    ;(async () => {
      const rec = await loadProject(project.id)
      if (!rec) return
      rec.meta.name = name
      await saveProject(rec)
      load()
    })()`

code = code.replace(oldRename, newRename)

fs.writeFileSync('src/pages/Dashboard.tsx', code)
