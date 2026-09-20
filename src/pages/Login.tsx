import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Brand, ThemeButton } from '../components/Layout'
import { useAuth } from '../lib/auth'
import { demo } from '../lib/supabase'

export function Login() {
  const { status, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'ready' || status === 'noAccess' || status === 'error') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const problem = await signIn(email, password)
    if (problem) setError(problem)
    setBusy(false)
  }

  return (
    <div className="center-screen">
      <ThemeButton className="corner-toggle" />
      <div className="center-card">
        <Brand />
        <h1>Sign in</h1>
        <p className="muted">This is a private site. It is only for people I have set up an account for.</p>
        <form onSubmit={submit} style={{ marginTop: '1.5rem' }}>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {demo && (
          <p className="notice ok" data-testid="demo-hint">
            Demo mode. Sign in as owner@example.com, client@example.com or viewer@example.com. The password is demo.
          </p>
        )}
        <p className="hint">Having trouble? Message me and I will sort it out.</p>
      </div>
    </div>
  )
}
