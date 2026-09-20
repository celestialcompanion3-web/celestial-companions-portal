import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { ErrorNote, Loading, PageHead } from '../components/bits'
import { useAuth } from '../lib/auth'
import { useData, useLoad } from '../lib/data'
import { firstName, formatDate, isoDay } from '../lib/format'
import { getSettings, listDecisions, listDocs, listQuestions, listUpdates } from '../lib/queries'
import { done, supabase } from '../lib/supabase'
import { T } from '../lib/tables'
import type { Decision, Doc, Message, Profile, Question, UpdateEntry } from '../types'

// ---- a generic list-and-form editor, used by every tab ----

type Value = string | boolean | number
type Values = Record<string, Value>

interface Field {
  name: string
  label: string
  type: 'text' | 'textarea' | 'markdown' | 'date' | 'number' | 'select' | 'checkbox'
  required?: boolean
  nullable?: boolean
  options?: Array<{ value: string; label: string }>
  help?: string
  pattern?: string
}

function toValues(row: Record<string, unknown>, fields: Field[]): Values {
  const out: Values = {}
  for (const f of fields) {
    const v = row[f.name]
    out[f.name] = f.type === 'checkbox' ? Boolean(v) : v == null ? '' : String(v)
  }
  return out
}

function toPayload(values: Values, fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = values[f.name]
    if (f.type === 'checkbox') out[f.name] = Boolean(v)
    else if (f.type === 'number') out[f.name] = v === '' ? 0 : Number(v)
    else if (typeof v === 'string' && v.trim() === '' && f.nullable) out[f.name] = null
    else out[f.name] = typeof v === 'string' && f.type !== 'markdown' && f.type !== 'textarea' ? v.trim() : v
  }
  return out
}

interface CrudProps<R extends { id: string }> {
  table: string
  noun: string
  rows: R[]
  fields: Field[]
  blank: Values
  label: (row: R) => string
  sub?: (row: R) => ReactNode
  canDelete?: boolean
  onChanged: () => void
  // Pre-filled values for a new entry, for example a drafted weekly report. A new id opens the form.
  startWith?: { id: number; values: Values }
  formExtra?: (values: Values) => ReactNode
  intro?: ReactNode
  toolbar?: ReactNode
}

function Crud<R extends { id: string }>({ table, noun, rows, fields, blank, label, sub, canDelete, onChanged, startWith, formExtra, intro, toolbar }: CrudProps<R>) {
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (startWith) setEditing({ id: null, values: startWith.values })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWith?.id])

  const set = (name: string, value: Value) => setEditing((e) => (e ? { ...e, values: { ...e.values, [name]: value } } : e))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = toPayload(editing.values, fields)
      await done(editing.id ? supabase.from(table).update(payload).eq('id', editing.id) : supabase.from(table).insert(payload))
      setEditing(null)
      setNotice(`${editing.id ? 'Saved' : 'Added'}.`)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save.')
    }
    setBusy(false)
  }

  async function remove(row: R) {
    if (!window.confirm(`Delete "${label(row)}"? This cannot be undone.`)) return
    setError('')
    try {
      await done(supabase.from(table).delete().eq('id', row.id))
      setEditing(null)
      setNotice('Deleted.')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not delete.')
    }
  }

  return (
    <div>
      {intro && <p className="muted sans small" style={{ marginTop: 0 }}>{intro}</p>}
      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn small" onClick={() => setEditing({ id: null, values: { ...blank } })}>
          Add {noun}
        </button>
        {toolbar}
      </div>
      {notice && !editing && (
        <p className="notice ok" role="status">
          {notice}
        </p>
      )}
      {error && !editing && <ErrorNote error={error} />}

      {editing && (
        <form className="card manage-form" onSubmit={save} aria-label={`${editing.id ? 'Edit' : 'New'} ${noun}`}>
          <h3>{editing.id ? `Edit ${noun}` : `New ${noun}`}</h3>
          {fields.map((f) => {
            const value = editing.values[f.name]
            const common = { id: `f-${f.name}`, required: f.required }
            return (
              <label key={f.name} className={`field${f.type === 'checkbox' ? ' check' : ''}`}>
                <span>{f.label}</span>
                {f.type === 'textarea' || f.type === 'markdown' ? (
                  <textarea {...common} rows={f.type === 'markdown' ? 16 : 4} className={f.type === 'markdown' ? 'mono' : ''} value={String(value)} onChange={(e) => set(f.name, e.target.value)} />
                ) : f.type === 'select' ? (
                  <select {...common} value={String(value)} onChange={(e) => set(f.name, e.target.value)}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input id={common.id} type="checkbox" checked={Boolean(value)} onChange={(e) => set(f.name, e.target.checked)} />
                ) : (
                  <input {...common} type={f.type} pattern={f.pattern} value={String(value)} onChange={(e) => set(f.name, e.target.value)} />
                )}
                {f.help && <small>{f.help}</small>}
              </label>
            )
          })}
          {formExtra?.(editing.values)}
          {error && <ErrorNote error={error} />}
          <div className="btn-row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn quiet" onClick={() => { setEditing(null); setError('') }} disabled={busy}>
              Cancel
            </button>
            {canDelete && editing.id && (
              <button type="button" className="btn quiet danger" onClick={() => { const row = rows.find((r) => r.id === editing.id); if (row) void remove(row) }}>
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      <ul className="row-list manage-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="manage-row">
              <div>
                <span className="title">{label(row)}</span>
                {sub && <div className="when">{sub(row)}</div>}
              </div>
              <button type="button" className="btn quiet small" onClick={() => { setError(''); setNotice(''); setEditing({ id: row.id, values: toValues(row as unknown as Record<string, unknown>, fields) }) }}>
                Edit
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">Nothing here yet.</li>}
      </ul>
    </div>
  )
}

// ---- weekly report helpers ----

function draftWeekly(updates: UpdateEntry[], questions: Question[], messages: Message[], decisions: Decision[], people: Record<string, Profile>): Values {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  const from = isoDay(start)
  const to = isoDay(end)
  const clientIds = new Set(Object.values(people).filter((p) => p.role === 'client').map((p) => p.id))

  const finished = updates.filter((u) => u.status === 'published' && u.released_on >= from)
  const answeredNow = messages.filter((m) => m.question_id && clientIds.has(m.author_id) && m.created_at.slice(0, 10) >= from).length
  const waiting = questions.filter((q) => q.status === 'open' && !messages.some((m) => m.question_id === q.id && clientIds.has(m.author_id))).length
  const open = decisions.filter((d) => d.status === 'open').slice(0, 4)

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const lines: string[] = ['## What I did this week', '']
  if (finished.length) finished.forEach((u) => lines.push(`- **${u.title}.** ${u.summary}`))
  else lines.push('- No big update was finished this week. I kept working on the open items below.')

  lines.push('', '## Your answers', '')
  if (answeredNow) lines.push(`Thank you for answering ${plural(answeredNow, 'question')} this week.`)
  if (waiting) lines.push(`I am still waiting on ${plural(waiting, 'answer')}. They are on the Questions page, and there is no rush.`)
  if (!answeredNow && !waiting) lines.push('There are no questions waiting on you.')

  lines.push('', '## Next week', '')
  if (open.length) {
    lines.push('I will keep building. These choices are still open:', '')
    open.forEach((d) => lines.push(`- ${d.title}`))
  } else lines.push('- I will keep building and report on what gets finished.')

  return {
    kind: 'weekly',
    slug: `week-${to}`,
    title: `Weekly report: week of ${formatDate(from)}`,
    summary: finished.map((u) => u.title).join('. '),
    body_md: lines.join('\n'),
    pinned: false,
    period_start: from,
    period_end: to,
    status: 'draft',
  }
}

function plainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^- /gm, '• ')
    .trim()
}

function CopyAsEmail({ values, owner, client }: { values: Values; owner: string; client: string }) {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  async function make() {
    const link = `${window.location.origin}/reports/${String(values.slug)}`
    const email = [
      `Hello ${client},`,
      '',
      `Here is my report for the week of ${formatDate(String(values.period_start))}.`,
      '',
      plainText(String(values.body_md)),
      '',
      `You can read it, and answer or comment, on the site: ${link}`,
      '',
      'Best wishes,',
      owner,
    ].join('\n')
    setText(email)
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="email-box">
      <button type="button" className="btn quiet small" onClick={() => void make()}>
        Copy as email
      </button>
      {text && (
        <>
          <p className="muted sans small" role="status">
            {copied ? 'Copied. You can paste it into an email.' : 'Copy the text below into an email.'}
          </p>
          <textarea readOnly rows={12} value={text} aria-label="Email text" />
        </>
      )}
    </div>
  )
}

// ---- the page ----

const TABS = ['Demo', 'Updates', 'Documents', 'Questions', 'Decisions'] as const
type Tab = (typeof TABS)[number]

const statusOptions = [
  { value: 'draft', label: 'Draft (only you can see it)' },
  { value: 'published', label: 'Published' },
]

export function Manage() {
  const { isOwner } = useAuth()
  if (!isOwner) return <Navigate to="/" replace />
  return <ManageInner />
}

function ManageInner() {
  const { profile } = useAuth()
  const { people, messages } = useData()
  const [tab, setTab] = useState<Tab>('Demo')
  const [draft, setDraft] = useState<{ id: number; values: Values } | undefined>()

  const loaded = useLoad(async () => {
    const [docs, questions, decisions, updates, settings] = await Promise.all([listDocs(), listQuestions(), listDecisions(), listUpdates(), getSettings()])
    return { docs, questions, decisions, updates, settings }
  })

  if (loaded.loading && !loaded.data) return <Loading />
  if (!loaded.data) return <ErrorNote error={loaded.error} />
  const { docs, questions, decisions, updates, settings } = loaded.data
  const client = Object.values(people).find((p) => p.role === 'client')

  const docOptions = [{ value: '', label: 'None' }, ...docs.map((d) => ({ value: d.id, label: d.title }))]

  return (
    <>
      <PageHead eyebrow="Owner only" title="Manage" byline="Change what is on the site without touching any files." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <ErrorNote error={loaded.error} />

      {tab === 'Demo' && <DemoForm settings={settings} onChanged={loaded.reload} />}

      {tab === 'Updates' && (
        <Crud<UpdateEntry>
          table={T.updates}
          noun="update"
          rows={updates}
          onChanged={loaded.reload}
          canDelete
          intro="Add one entry each time a big piece of work is finished. Newest first on the Progress page."
          label={(u) => u.title}
          sub={(u) => `${formatDate(u.released_on)}${u.version ? ` · ${u.version}` : ''}${u.status === 'draft' ? ' · Draft' : ''}`}
          blank={{ title: '', summary: '', details_md: '', released_on: isoDay(new Date()), version: '', demo_url: '', status: 'published' }}
          fields={[
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'summary', label: 'Summary', type: 'textarea', required: true, help: 'One or two sentences, in plain words.' },
            { name: 'released_on', label: 'Date finished', type: 'date', required: true },
            { name: 'version', label: 'Version (optional)', type: 'text', nullable: true },
            { name: 'demo_url', label: 'Link to try this version (optional)', type: 'text', nullable: true, pattern: 'https://.*', help: 'Must start with https://' },
            { name: 'details_md', label: 'What changed (optional)', type: 'markdown', help: 'Markdown. A short list works well.' },
            { name: 'status', label: 'Status', type: 'select', options: statusOptions },
          ]}
        />
      )}

      {tab === 'Documents' && (
        <Crud<Doc>
          table={T.documents}
          noun="document"
          rows={docs}
          onChanged={loaded.reload}
          startWith={draft}
          intro="The blueprint and the weekly reports. A draft can only be seen by you. Documents cannot be deleted here, so nobody loses their comments."
          toolbar={
            <button type="button" className="btn quiet small" onClick={() => setDraft({ id: Date.now(), values: draftWeekly(updates, questions, messages, decisions, people) })}>
              Draft this week’s report
            </button>
          }
          label={(d) => d.title}
          sub={(d) => `${d.kind === 'weekly' ? 'Weekly report' : d.kind === 'blueprint' ? 'Blueprint' : 'Page'} · ${d.status === 'draft' ? 'Draft' : 'Published'}`}
          blank={{ kind: 'weekly', slug: '', title: '', summary: '', body_md: '', pinned: false, period_start: '', period_end: '', status: 'draft' }}
          fields={[
            { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'weekly', label: 'Weekly report' }, { value: 'blueprint', label: 'Blueprint' }, { value: 'page', label: 'Page' }] },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'slug', label: 'Address', type: 'text', required: true, pattern: '[a-z0-9\\-]{1,60}', help: 'Lower-case letters, numbers and dashes. It becomes part of the link.' },
            { name: 'summary', label: 'Short summary', type: 'textarea', nullable: true },
            { name: 'period_start', label: 'Week starts (weekly reports)', type: 'date', nullable: true },
            { name: 'period_end', label: 'Week ends (weekly reports)', type: 'date', nullable: true },
            { name: 'body_md', label: 'Text', type: 'markdown', help: 'Markdown. Second-level headings (##) make the contents list.' },
            { name: 'pinned', label: 'Pin to the top of the overview', type: 'checkbox' },
            { name: 'status', label: 'Status', type: 'select', options: statusOptions },
          ]}
          formExtra={(v) =>
            v.kind === 'weekly' && v.slug && v.period_start ? (
              <CopyAsEmail values={v} owner={profile?.display_name ?? ''} client={client?.display_name ?? 'there'} />
            ) : null
          }
        />
      )}

      {tab === 'Questions' && (
        <Crud<Question>
          table={T.questions}
          noun="question"
          rows={questions}
          onChanged={loaded.reload}
          intro="Close a question when it is settled. If the answer came by email, write it in the note. Questions cannot be deleted here, so nobody loses their answers."
          label={(q) => q.prompt}
          sub={(q) => `${q.status === 'closed' ? 'Closed' : 'Open'}${q.note ? ' · has a note' : ''}`}
          blank={{ key: `q${questions.length + 1}`, document_id: docs.find((d) => d.kind === 'blueprint')?.id ?? '', prompt: '', why: '', note: '', position: questions.length + 1, status: 'open' }}
          fields={[
            { name: 'prompt', label: 'Question', type: 'textarea', required: true },
            { name: 'why', label: 'Why I am asking (optional)', type: 'textarea', nullable: true },
            { name: 'key', label: 'Short name', type: 'text', required: true, pattern: '[a-z0-9\\-]{1,40}', help: 'For example q5. Must be different for every question.' },
            { name: 'document_id', label: 'Shown on', type: 'select', options: docOptions, nullable: true },
            { name: 'position', label: 'Order', type: 'number' },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open (accepts answers)' }, { value: 'closed', label: 'Closed (no new answers)' }] },
            { name: 'note', label: 'Note: an answer received another way, such as email (optional)', type: 'textarea', nullable: true },
          ]}
        />
      )}

      {tab === 'Decisions' && (
        <Crud<Decision>
          table={T.decisions}
          noun="decision"
          rows={decisions}
          onChanged={loaded.reload}
          canDelete
          label={(d) => d.title}
          sub={(d) => (d.status === 'decided' ? 'Decided' : d.status === 'parked' ? 'Parked' : 'Open')}
          blank={{ title: '', detail: '', status: 'open', outcome: '', decided_on: '', needed_by: '', position: decisions.length + 1 }}
          fields={[
            { name: 'title', label: 'Decision', type: 'text', required: true },
            { name: 'detail', label: 'Detail (optional)', type: 'textarea', nullable: true },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'decided', label: 'Decided' }, { value: 'parked', label: 'Parked for later' }] },
            { name: 'outcome', label: 'What was decided (optional)', type: 'textarea', nullable: true },
            { name: 'decided_on', label: 'Decided on', type: 'date', nullable: true },
            { name: 'needed_by', label: 'Needed by', type: 'date', nullable: true },
            { name: 'position', label: 'Order', type: 'number' },
          ]}
        />
      )}
      <p className="muted sans small" style={{ marginTop: '2rem' }}>
        {client ? `The person being asked is ${firstName(client.display_name)}.` : 'No client account has been added yet.'}
      </p>
    </>
  )
}

// ---- the live demo's details ----

const DEMO_KEYS = ['prototype_url', 'prototype_version', 'prototype_updated', 'prototype_note'] as const

function DemoForm({ settings, onChanged }: { settings: Record<string, string>; onChanged: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(DEMO_KEYS.map((k) => [k, settings[k] ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const set = (key: string, value: string) => {
    setSaved(false)
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (values.prototype_url.trim() && !/^https:\/\//i.test(values.prototype_url.trim())) return setError('The link must start with https://')
    setBusy(true)
    try {
      await done(supabase.from(T.settings).upsert(DEMO_KEYS.map((key) => ({ key, value: values[key].trim() })), { onConflict: 'key' }))
      setSaved(true)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save.')
    }
    setBusy(false)
  }

  return (
    <form className="card manage-form" onSubmit={save} aria-label="Live demo details">
      <h3>The live demo</h3>
      <p className="muted sans small" style={{ marginTop: 0 }}>
        These details appear on the Overview and Progress pages.
      </p>
      <label className="field">
        <span>Link</span>
        <input type="text" value={values.prototype_url} onChange={(e) => set('prototype_url', e.target.value)} placeholder="https://…" />
      </label>
      <label className="field">
        <span>Version</span>
        <input type="text" value={values.prototype_version} onChange={(e) => set('prototype_version', e.target.value)} />
      </label>
      <label className="field">
        <span>Date last updated</span>
        <input type="date" value={values.prototype_updated} onChange={(e) => set('prototype_updated', e.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <textarea rows={3} value={values.prototype_note} onChange={(e) => set('prototype_note', e.target.value)} />
      </label>
      {error && <ErrorNote error={error} />}
      {saved && (
        <p className="notice ok" role="status">
          Saved.
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
