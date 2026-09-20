import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DocStatusPill, ErrorNote, Loading, PageHead } from '../components/bits'
import { Markdown } from '../components/Markdown'
import { CommentThread, QuestionCard } from '../components/Thread'
import { useMe } from '../lib/auth'
import { useLoad } from '../lib/data'
import { formatDate, formatPeriod } from '../lib/format'
import type { Heading } from '../lib/markdown'
import { getDoc, listDocs, listQuestions } from '../lib/queries'
import type { Doc } from '../types'
import { NotFound } from './Screens'

function DocPage({ kind, slug }: { kind: Doc['kind']; slug?: string }) {
  const me = useMe()
  const [headings, setHeadings] = useState<Heading[]>([])
  const loaded = useLoad(async () => {
    const doc = await getDoc(kind, slug)
    const questions = doc ? (await listQuestions()).filter((q) => q.document_id === doc.id) : []
    return { doc, questions }
  }, [kind, slug])

  if (loaded.loading && !loaded.data) return <Loading />
  if (!loaded.data) return <ErrorNote error={loaded.error} />
  const { doc, questions } = loaded.data
  if (!doc) return <NotFound />

  const byline = kind === 'weekly' ? formatPeriod(doc.period_start, doc.period_end) : `Last updated ${formatDate(doc.updated_at)}`

  return (
    <article>
      <PageHead eyebrow={kind === 'weekly' ? 'Weekly report' : 'Celestial Companions'} title={doc.title} byline={byline}>
        <DocStatusPill doc={doc} />
        {headings.length > 1 && (
          <p className="toc">
            {headings.map((h, i) => (
              <span key={h.id}>
                {i > 0 && ' · '}
                <a href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                  {h.text}
                </a>
              </span>
            ))}
          </p>
        )}
      </PageHead>

      <Markdown source={doc.body_md} onHeadings={setHeadings} />

      {questions.length > 0 && (
        <section aria-labelledby="questions-title">
          <h2 id="questions-title">{kind === 'weekly' ? 'My questions' : 'Questions that need your help'}</h2>
          <p className="muted sans small" style={{ marginTop: 0 }}>
            {me.role === 'client'
              ? 'Your answer is saved on your account, so you can read or change it from any device.'
              : 'Answers appear here as they are saved.'}
          </p>
          <div>
            {questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} number={i + 1} />
            ))}
          </div>
        </section>
      )}

      <CommentThread documentId={doc.id} />
    </article>
  )
}

export function BlueprintPage() {
  return <DocPage kind="blueprint" />
}

export function ReportPage() {
  const { slug } = useParams()
  return <DocPage kind="weekly" slug={slug} key={slug} />
}

export function ReportsList() {
  const loaded = useLoad(async () => (await listDocs('weekly')).sort((a, b) => (b.period_start ?? '').localeCompare(a.period_start ?? '')))

  return (
    <>
      <PageHead eyebrow="Celestial Companions" title="Weekly reports" byline="One short report each week, on what got done and what comes next." />
      {loaded.loading && !loaded.data ? (
        <Loading />
      ) : (
        <>
          <ErrorNote error={loaded.error} />
          {loaded.data?.length === 0 && <p className="muted">No reports yet.</p>}
          <ul className="row-list">
            {loaded.data?.map((d) => (
              <li key={d.id}>
                <Link className="title" to={`/reports/${d.slug}`}>
                  {d.title}
                </Link>{' '}
                <DocStatusPill doc={d} />
                <span className="when">{formatPeriod(d.period_start, d.period_end)}</span>
                {d.summary && <p>{d.summary}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
