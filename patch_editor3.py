import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Replace the IIFE useEffect completely
old_effect_regex = re.compile(r'useEffect\(\(\) => \{\n\s+;\(async \(\) => \{\n\s+try \{\n\s+const fonts = await loadFonts\(\)[\s\S]*?setProjectLoading\(false\)\n\s+\}\n\s+\}\)\(\)\n\s+\}, \[\]\)')

new_effect = """useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (!project.getEngine()) {
          const fonts = await loadFonts()
          await project.init(fonts)
        }
        if (id) {
          const loaded = await loadProject(id)
          if (!active) return
          if (loaded) {
            setRecord(loaded)
            setActiveFilePath('/main.typ')
            await runCompile(loaded.files)
          } else {
            navigate('/')
          }
        }
      } catch (e) {
        console.error('Typst initialization failed', e)
      } finally {
        if (active) setProjectLoading(false)
      }
    })()
    return () => { active = false }
  }, [id, navigate])"""

code = old_effect_regex.sub(new_effect, code)

# Remove the session logic from EditorPage, since App.tsx handles it
session_regex = re.compile(r'const \[session, setSession\] = useState<any>\(null\)[\s\S]*?if \(!session\) return <Auth />\n')
code = session_regex.sub('', code)

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
