import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Fix fontLoader and preferences imports
code = code.replace("from './storage/fontLoader'", "from '../storage/fontLoader'")
code = code.replace("from './state/preferences'", "from '../state/preferences'")

# Remove migrateLegacy from cloudStore import
code = code.replace(", migrateLegacy,", ",")

# Check if id and navigate are used properly, remove duplicate load() ?
code = code.replace("const navigate = useNavigate()\n  const navigate = useNavigate()", "const navigate = useNavigate()")
code = code.replace("const { id } = useParams<{id: string}>()\n  const { id } = useParams<{id: string}>()", "const { id } = useParams<{id: string}>()")

# Find the useEffect that handles id and load
# Actually, wait, let's fix the id unused error. Did I replace the load function properly?
# 'id' is declared but its value is never read. This means my regex for 'load()' might have failed.
with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
