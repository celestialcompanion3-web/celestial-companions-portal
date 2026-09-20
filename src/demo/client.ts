// A stand-in for the Supabase client, used only by `npm run dev:demo` and the browser tests.
// It keeps sample data in the browser tab (sessionStorage) and applies the same rules as the real
// database (see supabase/schema.sql), so what you see here behaves like the real thing.
// It is never part of a normal build: supabase.ts only loads it when VITE_DEMO=1.
import seedJson from '../../content/seed.json'
import blueprintMd from '../../content/blueprint.md?raw'
import weeklyMd from '../../content/week-2026-09-14.md?raw'
import { T } from '../lib/tables'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>
interface User {
  id: string
  email: string
  password: string
}
interface State {
  tables: Tables
  users: User[]
  sessionUserId: string | null
}
interface Failure {
  message: string
}
interface Result {
  data: unknown
  error: Failure | null
}

const STORE_KEY = 'ccom-demo-state'

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)
const uuid = () => crypto.randomUUID()

// ---------- sample data ----------

const OWNER = '00000000-0000-4000-8000-000000000001'
const CLIENT = '00000000-0000-4000-8000-000000000002'
const VIEWER = '00000000-0000-4000-8000-000000000003'
const NOBODY = '00000000-0000-4000-8000-000000000004'

function fresh(): State {
  const files: Record<string, string> = { 'blueprint.md': blueprintMd, 'week-2026-09-14.md': weeklyMd }
  const stamp = '2026-09-19T12:00:00.000Z'
  const documents: Row[] = (seedJson.documents as Row[]).map((d) => ({
    id: uuid(),
    kind: d.kind,
    slug: d.slug,
    title: d.title,
    summary: d.summary ?? null,
    body_md: files[String(d.file)] ?? '',
    pinned: d.pinned ?? false,
    period_start: d.period_start ?? null,
    period_end: d.period_end ?? null,
    status: d.status,
    published_at: d.published_at ?? null,
    created_at: stamp,
    updated_at: stamp,
  }))
  const docId = (slug: unknown) => documents.find((d) => d.slug === slug)?.id ?? null
  const questions: Row[] = (seedJson.questions as Row[]).map((q) => ({
    id: uuid(),
    document_id: docId(q.document),
    key: q.key,
    prompt: q.prompt,
    why: q.why ?? null,
    note: q.note ?? null,
    position: q.position,
    status: q.status,
    created_at: stamp,
    updated_at: stamp,
  }))
  const decisions: Row[] = (seedJson.decisions as Row[]).map((d) => ({
    id: uuid(),
    title: d.title,
    detail: d.detail ?? null,
    status: d.status,
    outcome: d.outcome ?? null,
    decided_on: d.decided_on ?? null,
    needed_by: d.needed_by ?? null,
    position: d.position,
    created_at: stamp,
    updated_at: stamp,
  }))
  const updates: Row[] = (seedJson.updates as Row[]).map((u) => ({
    id: uuid(),
    title: u.title,
    summary: u.summary,
    details_md: u.details_md ?? '',
    released_on: u.released_on,
    version: u.version ?? null,
    demo_url: u.demo_url ?? null,
    status: u.status,
    created_at: stamp,
    updated_at: stamp,
  }))
  const settings: Row[] = Object.entries({
    ...seedJson.settings,
    prototype_url: 'https://demo.invalid/companion',
    prototype_version: 'v0.4',
    prototype_updated: '2026-09-20',
    prototype_note: 'A sample note about the live demo.',
  }).map(([key, value]) => ({ key, value, updated_at: stamp }))

  const q3 = questions.find((q) => q.key === 'q3')
  const answer = { id: uuid(), question_id: q3?.id ?? null, document_id: null, parent_id: null, author_id: CLIENT, body: 'A sample answer that was saved earlier.', created_at: '2026-09-20T10:15:00.000Z', updated_at: null }
  const reply = { id: uuid(), question_id: null, document_id: null, parent_id: answer.id, author_id: OWNER, body: 'Thank you, that helps. A sample reply.', created_at: '2026-09-20T11:00:00.000Z', updated_at: null }

  return {
    tables: {
      [T.profiles]: [
        { id: OWNER, display_name: 'Sam Owner', role: 'owner', created_at: stamp },
        { id: CLIENT, display_name: 'Ms Sample', role: 'client', created_at: stamp },
        { id: VIEWER, display_name: 'Vic Viewer', role: 'viewer', created_at: stamp },
      ],
      [T.documents]: documents,
      [T.questions]: questions,
      [T.decisions]: decisions,
      [T.updates]: updates,
      [T.settings]: settings,
      [T.messages]: [answer, reply],
    },
    // NOBODY can sign in but has no profile, to show the "No access yet" screen.
    users: [
      { id: OWNER, email: 'owner@example.com', password: 'demo' },
      { id: CLIENT, email: 'client@example.com', password: 'demo' },
      { id: VIEWER, email: 'viewer@example.com', password: 'demo' },
      { id: NOBODY, email: 'nobody@example.com', password: 'demo' },
    ],
    sessionUserId: null,
  }
}

function load(): State {
  try {
    const saved = sessionStorage.getItem(STORE_KEY)
    if (saved) return JSON.parse(saved) as State
  } catch {
    // fall through to fresh data
  }
  return fresh()
}

// ---------- the rules, as in schema.sql ----------

const DEFAULTS: Record<string, () => Row> = {
  [T.documents]: () => ({ summary: null, body_md: '', pinned: false, period_start: null, period_end: null, status: 'draft', published_at: null }),
  [T.questions]: () => ({ document_id: null, why: null, note: null, position: 0, status: 'open' }),
  [T.decisions]: () => ({ detail: null, status: 'open', outcome: null, decided_on: null, needed_by: null, position: 0 }),
  [T.updates]: () => ({ details_md: '', released_on: today(), version: null, demo_url: null, status: 'published' }),
  [T.settings]: () => ({ value: '' }),
  [T.messages]: () => ({ question_id: null, document_id: null, parent_id: null, updated_at: null }),
}

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === ''

export function createDemoClient() {
  const state = load()
  const save = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {
      // the demo still works without saving
    }
  }
  const listeners = new Set<(event: string, session: unknown) => void>()
  const session = () => {
    const user = state.users.find((u) => u.id === state.sessionUserId)
    return user ? { user: { id: user.id, email: user.email }, access_token: 'demo' } : null
  }
  const announce = (event: string) => listeners.forEach((cb) => cb(event, session()))

  const me = () => state.tables[T.profiles].find((p) => p.id === state.sessionUserId) as { role: string } | undefined
  const isMember = () => Boolean(me())
  const isOwner = () => me()?.role === 'owner'
  const canWrite = () => me()?.role === 'owner' || me()?.role === 'client'

  const denied = (table: string): Failure => ({ message: `permission denied for table ${table}` })
  const rls = (table: string): Failure => ({ message: `new row violates row-level security policy for table "${table}"` })

  function visible(table: string): Row[] {
    const all = state.tables[table]
    if (!state.sessionUserId || !isMember()) return []
    if (table === T.documents || table === T.updates) return isOwner() ? all : all.filter((r) => r.status === 'published')
    return all
  }

  function checkRow(table: string, row: Row, others: Row[]): Failure | null {
    const dup = (col: string) => others.some((o) => o[col] === row[col])
    if (table === T.documents) {
      if (typeof row.slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(row.slug)) return { message: 'new row violates check constraint "slug"' }
      if (blank(row.title)) return { message: 'new row violates check constraint "title"' }
      if (!['blueprint', 'weekly', 'page'].includes(String(row.kind))) return { message: 'new row violates check constraint "kind"' }
      if (dup('slug')) return { message: 'duplicate key value violates unique constraint "slug"' }
    }
    if (table === T.questions) {
      if (typeof row.key !== 'string' || !/^[a-z0-9-]{1,40}$/.test(row.key)) return { message: 'new row violates check constraint "key"' }
      if (blank(row.prompt)) return { message: 'new row violates check constraint "prompt"' }
      if (dup('key')) return { message: 'duplicate key value violates unique constraint "key"' }
    }
    if (table === T.decisions && blank(row.title)) return { message: 'new row violates check constraint "title"' }
    if (table === T.updates) {
      if (blank(row.title) || blank(row.summary)) return { message: 'new row violates check constraint "title"' }
      if (row.demo_url != null && !/^https:\/\//.test(String(row.demo_url))) return { message: 'new row violates check constraint "demo_url"' }
    }
    return null
  }

  function insertOne(table: string, input: Row): Failure | null {
    if (table === T.profiles) return denied(table)
    if (table === T.messages) {
      if (!state.sessionUserId || !canWrite()) return rls(table)
    } else if (!isOwner()) return rls(table)

    const row: Row = { id: uuid(), created_at: now(), updated_at: now(), ...DEFAULTS[table](), ...input }
    if (table === T.messages) {
      row.updated_at = null
      row.author_id = input.author_id ?? state.sessionUserId
      if (row.author_id !== state.sessionUserId) return rls(table)
      const links = ['question_id', 'document_id', 'parent_id'].filter((k) => row[k] != null).length
      if (links !== 1) return { message: 'new row violates check constraint "num_nonnulls"' }
      if (typeof row.body !== 'string' || row.body.trim().length < 1 || row.body.length > 4000) return { message: 'new row violates check constraint "body"' }
      if (row.question_id != null) {
        const q = state.tables[T.questions].find((x) => x.id === row.question_id)
        if (!q || q.status !== 'open') return rls(table)
        if (state.tables[T.messages].some((m) => m.question_id === row.question_id && m.author_id === row.author_id)) {
          return { message: 'duplicate key value violates unique constraint "ccom_messages_one_answer_per_author"' }
        }
      }
    } else {
      const problem = checkRow(table, row, state.tables[table])
      if (problem) return problem
      if (table === T.documents && row.status === 'published' && !row.published_at) row.published_at = now()
    }
    state.tables[table].push(row)
    return null
  }

  function updateOne(table: string, row: Row, patch: Row): Failure | null {
    if (table === T.profiles) return denied(table)
    if (table === T.messages) {
      if (row.author_id !== state.sessionUserId || !canWrite()) return rls(table)
      for (const k of ['author_id', 'question_id', 'document_id', 'parent_id', 'created_at']) {
        if (k in patch && patch[k] !== row[k]) return { message: 'only the text of a message can be changed' }
      }
      if ('body' in patch) {
        if (typeof patch.body !== 'string' || patch.body.trim().length < 1 || patch.body.length > 4000) return { message: 'new row violates check constraint "body"' }
        if (patch.body !== row.body) row.updated_at = now()
        row.body = patch.body
      }
      return null
    }
    if (!isOwner()) return rls(table)
    const next = { ...row, ...patch }
    const problem = checkRow(table, next, state.tables[table].filter((r) => r !== row))
    if (problem) return problem
    Object.assign(row, patch, { updated_at: now() })
    if (table === T.documents && row.status === 'published' && !row.published_at) row.published_at = now()
    return null
  }

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    private filters: Array<[string, unknown]> = []
    private orders: Array<{ col: string; ascending: boolean; nullsFirst?: boolean }> = []
    private max: number | undefined
    private payload: Row | Row[] = {}
    private conflict = 'id'
    private one = false
    private table: string

    constructor(table: string) {
      this.table = table
    }

    select(_columns?: string) {
      return this
    }
    insert(payload: Row | Row[]) {
      this.op = 'insert'
      this.payload = payload
      return this
    }
    update(payload: Row) {
      this.op = 'update'
      this.payload = payload
      return this
    }
    upsert(payload: Row | Row[], options?: { onConflict?: string }) {
      this.op = 'upsert'
      this.payload = payload
      this.conflict = options?.onConflict ?? 'id'
      return this
    }
    delete() {
      this.op = 'delete'
      return this
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value])
      return this
    }
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
      this.orders.push({ col: column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst })
      return this
    }
    limit(count: number) {
      this.max = count
      return this
    }
    maybeSingle() {
      this.one = true
      return this
    }

    then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return new Promise<Result>((resolve) => setTimeout(() => resolve(this.run()), 0)).then(onfulfilled, onrejected)
    }

    private matches(row: Row) {
      return this.filters.every(([col, value]) => row[col] === value)
    }

    private run(): Result {
      const table = this.table
      if (!state.sessionUserId) return { data: null, error: denied(table) }
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      let failure: Failure | null = null

      if (this.op === 'select') {
        let list = visible(table).filter((r) => this.matches(r))
        for (const { col, ascending, nullsFirst } of [...this.orders].reverse()) {
          const nullsAtStart = nullsFirst ?? !ascending
          list = [...list].sort((a, b) => {
            const x = a[col] as string | number | null
            const y = b[col] as string | number | null
            if (x == null || y == null) return x == null && y == null ? 0 : (x == null) === nullsAtStart ? -1 : 1
            const c = x < y ? -1 : x > y ? 1 : 0
            return ascending ? c : -c
          })
        }
        if (this.max !== undefined) list = list.slice(0, this.max)
        const copy = structuredClone(list)
        return { data: this.one ? (copy[0] ?? null) : copy, error: null }
      }

      if (this.op === 'insert') {
        for (const item of items) if (!failure) failure = insertOne(table, item)
      } else if (this.op === 'upsert') {
        for (const item of items) {
          if (failure) break
          const existing = state.tables[table].find((r) => r[this.conflict] === item[this.conflict])
          failure = existing ? updateOne(table, existing, item) : insertOne(table, item)
        }
      } else if (this.op === 'update') {
        for (const row of visible(table).filter((r) => this.matches(r))) if (!failure) failure = updateOne(table, row, items[0])
      } else if (this.op === 'delete') {
        if (table === T.messages || table === T.profiles) failure = denied(table)
        else if (!isOwner()) failure = rls(table)
        else state.tables[table] = state.tables[table].filter((r) => !this.matches(r))
      }
      if (failure) return { data: null, error: failure }
      save()
      return { data: null, error: null }
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    auth: {
      async getSession() {
        return { data: { session: session() }, error: null }
      },
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        listeners.add(callback)
        setTimeout(() => callback('INITIAL_SESSION', session()), 0)
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        await new Promise((r) => setTimeout(r, 150))
        const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password)
        if (!user) return { data: { session: null }, error: { message: 'Invalid login credentials' } }
        state.sessionUserId = user.id
        save()
        announce('SIGNED_IN')
        return { data: { session: session() }, error: null }
      },
      async signOut() {
        state.sessionUserId = null
        save()
        announce('SIGNED_OUT')
        return { error: null }
      },
      async updateUser({ password }: { password: string }) {
        const user = state.users.find((u) => u.id === state.sessionUserId)
        if (!user) return { data: null, error: { message: 'Not signed in' } }
        if (password.length < 6) return { data: null, error: { message: 'Password should be at least 6 characters.' } }
        user.password = password
        save()
        return { data: { user: { id: user.id } }, error: null }
      },
    },
  }

  // For the browser tests: look at the stored data, or start again.
  ;(window as unknown as { __demoDb: unknown }).__demoDb = {
    tables: () => structuredClone(state.tables),
    reset: () => {
      sessionStorage.removeItem(STORE_KEY)
      window.location.reload()
    },
  }

  return client
}
