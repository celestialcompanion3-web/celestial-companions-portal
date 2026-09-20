import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { DataProvider } from '../lib/data'
import { firstName } from '../lib/format'
import { toggleTheme, useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './Icons'

export function ThemeButton({ className = '' }: { className?: string }) {
  const theme = useTheme()
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={() => toggleTheme()}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/favicon.svg" alt="" width="26" height="26" />
      Celestial Companions
    </Link>
  )
}

export function Layout(): ReactNode {
  const { profile, isOwner } = useAuth()
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/manage')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const links: Array<[string, string, boolean?]> = [
    ['/', 'Overview', true],
    ['/blueprint', 'Blueprint'],
    ['/progress', 'Progress'],
    ['/reports', 'Weekly reports'],
    ['/questions', 'Questions'],
    ['/decisions', 'Decisions'],
  ]

  return (
    <DataProvider>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="main-nav" aria-label="Main">
            {links.map(([to, text, end]) => (
              <NavLink key={to} to={to} end={end}>
                {text}
              </NavLink>
            ))}
            {isOwner && <NavLink to="/manage">Manage</NavLink>}
          </nav>
          <div className="header-actions">
            <ThemeButton />
            {profile && (
              <Link to="/account" className="user-link" aria-label="Your account">
                <span className="avatar">{profile.display_name.charAt(0).toUpperCase()}</span>
                <span className="name">{firstName(profile.display_name)}</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={`page${wide ? ' wide' : ''}`}>
        <Outlet />
      </main>
      <footer className={`site-footer${wide ? ' wide' : ''}`}>
        <div>Celestial Companions · a private site. Nothing here is public.</div>
      </footer>
    </DataProvider>
  )
}
