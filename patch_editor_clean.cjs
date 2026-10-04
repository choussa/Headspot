const fs = require('fs')

let code = fs.readFileSync('src/pages/EditorPage.tsx', 'utf8')

// Fix imports
code = code.replace(/from '\.\/storage\/projectStore'/g, "from '../storage/cloudStore'")
code = code.replace(/from '\.\/state\/workspace'/g, "from '../state/workspace'")
code = code.replace(/from '\.\/components/g, "from '../components")
code = code.replace(/from '\.\/compiler/g, "from '../compiler")
code = code.replace(/from '\.\/editor/g, "from '../editor")
code = code.replace(/from '\.\/preview/g, "from '../preview")
code = code.replace(/from '\.\/state\/preferences'/g, "from '../state/preferences'")
code = code.replace(/from '\.\/storage\/fontLoader'/g, "from '../storage/fontLoader'")
code = code.replace(/from '\.\/templates\/blank\.typ\?raw'/g, "from '../templates/blank.typ?raw'")

// Add react-router-dom imports
code = "import { useParams, useNavigate, Link } from 'react-router-dom'\n" + code

// Change function name
code = code.replace("export default function App() {", "export function EditorPage() {")

// Insert router hooks right after function start
code = code.replace("export function EditorPage() {\n", "export function EditorPage() {\n  const { id } = useParams<{id: string}>()\n  const navigate = useNavigate()\n")

// Remove migrateLegacy from import
code = code.replace(", migrateLegacy,", ",")

// Fix the load logic
const oldLoadStr = `        const metas = await listProjects()
        let first = metas[0] ? await loadProject(metas[0].id) : await migrateLegacy()
        if (!first) {
          first = createProject('Untitled', blank)
          await saveProject(first)
        }
        setRecord(first)
        setActiveFilePath('/main.typ')
        await runCompile(first.files)`

const newLoadStr = `        if (id) {
          const loaded = await loadProject(id)
          if (loaded) {
            setRecord(loaded)
            setActiveFilePath('/main.typ')
            await runCompile(loaded.files)
          } else {
            navigate('/')
          }
        }`

code = code.replace(oldLoadStr, newLoadStr)

// Replace brand-mark with Link to dashboard
code = code.replace('<div className="brand-mark">typst</div>', '<Link to="/" className="brand-mark no-underline hover:text-white" style={{textDecoration: "none"}}>typst</Link>')

// Hide the "Sign Out" from EditorPage since we can put it in Dashboard, or keep it.
// If it's missing supabase import, let's just make it a link to dashboard for now, or import supabase.
if (!code.includes("import { supabase }")) {
  code = "import { supabase } from '../lib/supabase'\n" + code
}

// Add topbar sign out if missing (since we reset git)
if (!code.includes("supabase.auth.signOut()")) {
  code = code.replace('<div className="top-actions">', '<div className="top-actions">\n          <button className="icon-button" title="Sign Out" onClick={() => supabase.auth.signOut()}>⎋</button>')
}

fs.writeFileSync('src/pages/EditorPage.tsx', code)
