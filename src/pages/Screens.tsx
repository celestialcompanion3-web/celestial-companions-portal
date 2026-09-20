import type { ReactNode } from 'react'
import { Brand, ThemeButton } from '../components/Layout'
import { useAuth } from '../lib/auth'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="center-screen">
      <ThemeButton className="corner-toggle" />
      <div className="center-card">
        <Brand />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function NotConfigured() {
  return (
    <Shell title="Not connected yet">
      <p className="muted">This site has no database connection yet. If you are the owner, add these two settings and build it again:</p>
      <ul className="sans small">
        <li>
          <code>VITE_SUPABASE_URL</code>
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code>
        </li>
      </ul>
      <p className="hint">Locally they go in a file called .env.local. On Vercel they go under Settings, then Environment Variables, as plain (not secret) values.</p>
    </Shell>
  )
}

export function NoAccess() {
  const { email, signOut } = useAuth()
  return (
    <Shell title="No access yet">
      <p className="muted">
        You are signed in{email ? ` as ${email}` : ''}, but this account has not been added to the site. Message me and I will add it.
      </p>
      <button type="button" className="btn quiet" onClick={() => void signOut()}>
        Sign out
      </button>
    </Shell>
  )
}

export function ProblemScreen() {
  const { error, signOut } = useAuth()
  return (
    <Shell title="Something is not right">
      <p className="notice error" role="alert">
        {error}
      </p>
      <p className="muted small sans">If this says a table does not exist, the database setup has not been run yet (schema.sql in the Supabase SQL editor).</p>
      <button type="button" className="btn quiet" onClick={() => void signOut()}>
        Sign out
      </button>
    </Shell>
  )
}

export function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p className="muted">That page does not exist. Use the menu at the top to get back.</p>
    </>
  )
}
