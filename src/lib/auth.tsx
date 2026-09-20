import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { T } from './tables'
import type { Profile } from '../types'

type Status = 'loading' | 'signedOut' | 'noAccess' | 'error' | 'ready'

interface Auth {
  status: Status
  email: string
  profile: Profile | null
  error: string
  isOwner: boolean
  canWrite: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = not known yet, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession((current) => (current === undefined ? data.session : current))
    })
    // Only store the session here. Querying the database inside this callback can stall the client,
    // so the profile is loaded in a separate effect below.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const known = session !== undefined
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!known) return
    if (!userId) {
      setProfile(null)
      setError('')
      return
    }
    let alive = true
    setProfile(undefined)
    supabase
      .from(T.profiles)
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error: problem }) => {
        if (!alive) return
        setError(problem ? problem.message : '')
        setProfile((data as Profile | null) ?? null)
      })
    return () => {
      alive = false
    }
  }, [known, userId])

  const value = useMemo<Auth>(() => {
    let status: Status = 'ready'
    if (!known || (userId && profile === undefined)) status = 'loading'
    else if (!userId) status = 'signedOut'
    else if (error) status = 'error'
    else if (!profile) status = 'noAccess'
    const role = profile?.role
    return {
      status,
      email: session?.user.email ?? '',
      profile: profile ?? null,
      error,
      isOwner: role === 'owner',
      canWrite: role === 'owner' || role === 'client',
      async signIn(email, password) {
        const { error: problem } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (!problem) return null
        return /invalid login/i.test(problem.message)
          ? 'That email and password do not match. Please check them and try again.'
          : problem.message
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }
  }, [known, userId, profile, error, session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): Auth {
  const value = useContext(Ctx)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

// For screens that only render once the person is signed in and has a profile.
export function useMe(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('No profile')
  return profile
}
