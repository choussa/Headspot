const fs = require('fs')

let code = fs.readFileSync('src/App.tsx', 'utf8')

// Add imports if not exist
if (!code.includes("import { supabase }")) {
  code = `import { supabase } from './lib/supabase'\nimport { Auth } from './components/Auth'\n` + code
}

// Add session state to App component
if (!code.includes("const [session, setSession]")) {
  const appStart = code.indexOf('export default function App() {')
  const insertIndex = code.indexOf('\n', appStart) + 1
  
  const authLogic = `
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!session) {
    return <Auth />
  }
`
  code = code.slice(0, insertIndex) + authLogic + code.slice(insertIndex)
}

// Add sign out button to topbar
if (!code.includes("supabase.auth.signOut()")) {
  const topActions = code.indexOf('<div className="top-actions">')
  const insertIndex = code.indexOf('\n', topActions) + 1
  
  const signOutBtn = `          <button className="icon-button" title="Sign Out" onClick={() => supabase.auth.signOut()}>⎋</button>\n`
  code = code.slice(0, insertIndex) + signOutBtn + code.slice(insertIndex)
}

fs.writeFileSync('src/App.tsx', code)
