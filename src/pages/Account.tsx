import { useState, type FormEvent } from 'react'
import { PageHead } from '../components/bits'
import { useAuth, useMe } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function Account() {
  const me = useMe()
  const { email, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function change(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    if (password.length < 10) return setResult({ ok: false, text: 'Please use at least 10 characters.' })
    if (password !== again) return setResult({ ok: false, text: 'The two passwords are not the same.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setResult({ ok: false, text: error.message })
    setPassword('')
    setAgain('')
    setResult({ ok: true, text: 'Your password has been changed.' })
  }

  const roleText = me.role === 'owner' ? 'Owner' : me.role === 'client' ? 'Client' : 'Viewer'

  return (
    <>
      <PageHead eyebrow="Celestial Companions" title="Your account" />
      <div className="card">
        <p style={{ margin: 0 }}>
          <b>{me.display_name}</b> <span className="pill">{roleText}</span>
        </p>
        <p className="muted sans small" style={{ margin: '0.2rem 0 0' }}>
          {email}
        </p>
      </div>

      <h2 style={{ fontSize: '1.25rem' }}>Change your password</h2>
      <form onSubmit={change} style={{ maxWidth: '24rem' }}>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <small>At least 10 characters. A few random words works well.</small>
        </label>
        <label className="field">
          <span>New password again</span>
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {result && (
          <p className={`notice ${result.ok ? 'ok' : 'error'}`} role={result.ok ? 'status' : 'alert'}>
            {result.text}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy || !password}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>

      <h2 style={{ fontSize: '1.25rem' }}>Sign out</h2>
      <button type="button" className="btn quiet" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  )
}
