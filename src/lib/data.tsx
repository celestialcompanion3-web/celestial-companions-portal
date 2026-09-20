import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { done, rows, supabase } from './supabase'
import { T } from './tables'
import type { Message, Profile } from '../types'

// ---- a small loader for one-off reads ----

export interface Loaded<V> {
  data: V | undefined
  error: string
  loading: boolean
  reload: () => void
}

export function useLoad<V>(load: () => Promise<V>, deps: unknown[] = []): Loaded<V> {
  const [state, setState] = useState<{ data: V | undefined; error: string; loading: boolean }>({ data: undefined, error: '', loading: true })
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    loadRef.current().then(
      (data) => alive && setState({ data, error: '', loading: false }),
      (e: unknown) => alive && setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false })),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { ...state, reload: () => setTick((n) => n + 1) }
}

// ---- people and messages, shared by every screen ----

interface NewMessage {
  question_id?: string
  document_id?: string
  parent_id?: string
  body: string
}

interface Store {
  people: Record<string, Profile>
  messages: Message[]
  ready: boolean
  error: string
  refresh: () => Promise<void>
  post: (message: NewMessage) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  nameOf: (id: string, myId: string) => string
}

const Ctx = createContext<Store | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Record<string, Profile>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [profiles, all] = await Promise.all([
        rows<Profile>(supabase.from(T.profiles).select('*')),
        rows<Message>(supabase.from(T.messages).select('*').order('created_at', { ascending: true })),
      ])
      setPeople(Object.fromEntries(profiles.map((p) => [p.id, p])))
      setMessages(all)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    // Pick up new replies when the person comes back to this tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const value = useMemo<Store>(
    () => ({
      people,
      messages,
      ready,
      error,
      refresh,
      async post(message) {
        await done(supabase.from(T.messages).insert({ ...message, body: message.body.trim() }))
        await refresh()
      },
      async edit(id, body) {
        await done(supabase.from(T.messages).update({ body: body.trim() }).eq('id', id))
        await refresh()
      },
      nameOf: (id, myId) => (id === myId ? 'You' : (people[id]?.display_name ?? 'Someone')),
    }),
    [people, messages, ready, error, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): Store {
  const value = useContext(Ctx)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}

// The messages that belong to one answer or comment: replies to it, and replies to those replies.
export function repliesTo(messages: Message[], rootId: string): Message[] {
  const out: Message[] = []
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    for (const m of messages) {
      if (m.parent_id === id) {
        out.push(m)
        queue.push(m.id)
      }
    }
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at))
}
