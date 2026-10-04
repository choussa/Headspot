const fs = require('fs')

let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8')

// Force add them to the top import
code = code.replace(
  "import { listProjects, createNewCloudProject, deleteProject } from '../storage/cloudStore'", 
  "import { listProjects, createNewCloudProject, deleteProject, loadProject, saveProject } from '../storage/cloudStore'"
)

fs.writeFileSync('src/pages/Dashboard.tsx', code)
