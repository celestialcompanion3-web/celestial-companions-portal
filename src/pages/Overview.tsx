import { Link } from 'react-router-dom'
import { ErrorNote, Loading, SectionTitle } from '../components/bits'
import { ExternalIcon } from '../components/Icons'
import { useAuth, useMe } from '../lib/auth'
import { useData, useLoad } from '../lib/data'
import { firstName, formatDate, formatPeriod } from '../lib/format'
import { getDoc, getSettings, listDecisions, listDocs, listQuestions, listUpdates } from '../lib/queries'

export function Overview() {
  const me = useMe()
  const { isOwner } = useAuth()
  const { messages, people } = useData()

  const all = useLoad(async () => {
    const [blueprint, weekly, questions, decisions, updates, settings] = await Promise.all([
      getDoc('blueprint'),
      listDocs('weekly'),
      listQuestions(),
      listDecisions(),
      listUpdates(),
      getSettings(),
    ])
    return { blueprint, weekly, questions, decisions, updates, settings }
  })

  if (all.loading && !all.data) return <Loading />
  if (!all.data) return <ErrorNote error={all.error} />
  const { blueprint, weekly, questions, decisions, updates, settings } = all.data

  const client = Object.values(people).find((p) => p.role === 'client')
  const clientIds = new Set(Object.values(people).filter((p) => p.role === 'client').map((p) => p.id))
  const answeredByClient = (id: string) => messages.some((m) => m.question_id === id && clientIds.has(m.author_id))
  const answeredByMe = (id: string) => messages.some((m) => m.question_id === id && m.author_id === me.id)

  const open = questions.filter((q) => q.status === 'open')
  const waiting = isOwner ? open.filter((q) => !answeredByClient(q.id)).length : me.role === 'client' ? open.filter((q) => !answeredByMe(q.id)).length : 0
  const waitingText = isOwner ? `questions waiting on ${client?.display_name ?? 'the client'}` : 'questions waiting for you'
  const openDecisions = decisions.filter((d) => d.status === 'open').length
  const latestUpdate = updates.find((u) => u.status === 'published') ?? updates[0]
  const latestReport = weekly.find((d) => d.status === 'published') ?? weekly[0]

  return (
    <>
      <p className="eyebrow">Celestial Companions · private site</p>
      <h1>Hello, {firstName(me.display_name)}</h1>
      <p className="lede">Everything for the project is here: the plan, what I have finished, and the questions I need your help with.</p>

      {blueprint && (
        <div className="card featured">
          <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
            The plan · updated {formatDate(blueprint.updated_at)}
          </p>
          <h2>
            <Link to="/blueprint">{blueprint.title}</Link>
          </h2>
          {blueprint.summary && <p>{blueprint.summary}</p>}
          <Link className="btn" to="/blueprint">
            Read the Blueprint
          </Link>
        </div>
      )}

      <div className="stat-row">
        <Link className="stat" to="/questions">
          <b>{waiting}</b>
          <span>{waitingText}</span>
        </Link>
        <Link className="stat" to="/decisions">
          <b>{openDecisions}</b>
          <span>decisions still open</span>
        </Link>
        <Link className="stat" to="/progress">
          <b>{settings.prototype_version || '–'}</b>
          <span>demo version</span>
        </Link>
      </div>

      <SectionTitle title="Try the live demo" to="/progress" linkText="Progress" />
      <div className="card">
        <h3>
          The live demo {settings.prototype_version && <span className="pill">{settings.prototype_version}</span>}
        </h3>
        {settings.prototype_note && <p>{settings.prototype_note}</p>}
        <p className="muted sans small">
          {settings.prototype_updated ? `Last updated ${formatDate(settings.prototype_updated)}. ` : ''}It is a working test, so what you see can change as I build.
        </p>
        {settings.prototype_url ? (
          <a className="btn" href={settings.prototype_url} target="_blank" rel="noreferrer">
            Open the demo <ExternalIcon />
          </a>
        ) : (
          <p className="muted sans small">The demo link has not been added yet.</p>
        )}
      </div>

      {latestUpdate && (
        <>
          <SectionTitle title="Latest update" to="/progress" linkText="All updates" />
          <div className="card">
            <p className="muted sans small" style={{ margin: 0 }}>
              {formatDate(latestUpdate.released_on)}
              {latestUpdate.version ? ` · ${latestUpdate.version}` : ''}
            </p>
            <h3>{latestUpdate.title}</h3>
            <p>{latestUpdate.summary}</p>
          </div>
        </>
      )}

      {latestReport && (
        <>
          <SectionTitle title="Latest weekly report" to="/reports" linkText="All reports" />
          <div className="card">
            <p className="muted sans small" style={{ margin: 0 }}>
              {formatPeriod(latestReport.period_start, latestReport.period_end)}
            </p>
            <h3>
              <Link to={`/reports/${latestReport.slug}`}>{latestReport.title}</Link>
            </h3>
            {latestReport.summary && <p>{latestReport.summary}</p>}
          </div>
        </>
      )}
    </>
  )
}
