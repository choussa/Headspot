with open('src/state/workspace.ts', 'r') as f:
    code = f.read()

if "folderId?: string | null" not in code:
    code = code.replace("name: string", "name: string\n  folderId?: string | null")

with open('src/state/workspace.ts', 'w') as f:
    f.write(code)
