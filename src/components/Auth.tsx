import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setMessage('Check your email for the confirmation link!')
    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-200">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">typst<span className="text-neutral-500">.saas</span></h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in to access your reports</p>
        </div>
        
        <form className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          
          {error && <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded">{error}</div>}
          {message && <div className="text-xs text-green-400 bg-green-950/50 p-2 rounded">{message}</div>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none disabled:opacity-50"
            >
              {loading ? '...' : 'Sign In'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 rounded bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 focus:outline-none disabled:opacity-50"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
