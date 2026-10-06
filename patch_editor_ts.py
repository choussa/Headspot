import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Fix activePanel type
code = code.replace("useState<'files' | 'settings' | null>('files')", "useState<string | null>('files')")

# Fix onLoadLocalFonts in SettingsPanel mount
code = code.replace("onLoadLocalFonts={onLoadLocalFonts}", "")

# Some unused variables exist, but let's just make the activePanel fix so TS doesn't crash on type mismatches.
with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
