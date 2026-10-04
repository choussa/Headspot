import { useId, useState } from 'react'
import { Loader2, TriangleAlert, CircleCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const emailId = useId()
  const passwordId = useId()

  const run = async (action: 'signin' | 'signup') => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (action === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) setError(err.message)
        else setMessage('Check your email for the confirmation link, then sign in.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) setError(err.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-app px-4 text-fg">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-[0_24px_64px_-24px_rgba(0,0,0,.55)]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            typst<span className="text-fg-3">.saas</span>
          </h1>
          <p className="mt-2 text-sm text-fg-2">Sign in to access your reports</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!loading) void run('signin')
          }}
        >
          <div>
            <label htmlFor={emailId} className="mb-1 block text-xs font-medium text-fg-2">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-control bg-raised px-3 py-2 text-sm text-fg placeholder:text-fg-3"
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="mb-1 block text-xs font-medium text-fg-2">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-control bg-raised px-3 py-2 text-sm text-fg placeholder:text-fg-3"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-[13px] text-danger">
              <TriangleAlert size={14} className="mt-px shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}
          {message && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5 text-[13px] text-accent">
              <CircleCheck size={14} className="mt-px shrink-0" />
              <span className="min-w-0 break-words">{message}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-fill px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              Sign In
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void run('signup')}
              className="flex-1 rounded-lg border border-line bg-raised px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-line disabled:opacity-50"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
