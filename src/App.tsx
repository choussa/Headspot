import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import { Auth } from './components/Auth'
import { Dashboard } from './pages/Dashboard'
import { EditorPage } from './pages/EditorPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeTheme } from './state/preferences'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeTheme()
  }, [])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="flex h-screen w-screen items-center justify-center gap-2 bg-app text-fg-3">
      <span role="status" aria-live="polite" className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading…
      </span>
    </div>
  )
  
  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
