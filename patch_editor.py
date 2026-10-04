import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Fix imports
code = code.replace("from './storage/projectStore'", "from '../storage/cloudStore'")
code = code.replace("from './storage/cloudStore'", "from '../storage/cloudStore'")
code = code.replace("from './state/workspace'", "from '../state/workspace'")
code = code.replace("from './lib/supabase'", "from '../lib/supabase'")
code = code.replace("from './components/", "from '../components/")
code = code.replace("from './compiler/", "from '../compiler/")
code = code.replace("from './editor/", "from '../editor/")
code = code.replace("from './preview/", "from '../preview/")

if "useParams" not in code:
    code = "import { useParams, useNavigate, Link } from 'react-router-dom'\n" + code

# Rename App to EditorPage
code = code.replace("export default function App()", "export function EditorPage()")

# Replace load logic
load_regex = re.compile(r'async function load\(\) \{[\s\S]*?setProjectLoading\(false\)\n  \}')
new_load = """async function load() {
    setProjectLoading(true)
    if (!id) return
    const rec = await loadProject(id)
    if (rec) {
      setRecord(rec)
      if (!rec.files.some((f) => f.path === activeFilePath)) {
        setActiveFilePath(MAIN_PATH)
      }
    } else {
      navigate('/')
    }
    setProjectLoading(false)
  }"""
code = load_regex.sub(new_load, code)

# Update useEffect to depend on id
code = code.replace("useEffect(() => {\n    load()", "useEffect(() => {\n    if (id) load()")
# Add const { id } = useParams() inside EditorPage
if "const { id } = useParams" not in code:
    code = code.replace("export function EditorPage() {\n", "export function EditorPage() {\n  const { id } = useParams<{id: string}>()\n  const navigate = useNavigate()\n")

# Make 'typst' logo a link to dashboard
code = code.replace('<div className="brand-mark">typst</div>', '<Link to="/" className="brand-mark no-underline hover:text-white">typst</Link>')

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
