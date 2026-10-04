with open('src/state/workspace.ts', 'r') as f:
    code = f.read()

if "thumbnail?: string | null" not in code:
    code = code.replace("folderId?: string | null", "folderId?: string | null\n  thumbnail?: string | null")

with open('src/state/workspace.ts', 'w') as f:
    f.write(code)
