import { Link } from 'react-router-dom'
import { ErrorNote, Loading, PageHead } from '../components/bits'
import { QuestionCard } from '../components/Thread'
import { useMe } from '../lib/auth'
import { useData, useLoad } from '../lib/data'
import { listDocs, listQuestions } from '../lib/queries'

export function Questions() {
  const me = useMe()
  const { messages } = useData()
  const loaded = useLoad(async () => {
    const [questions, docs] = await Promise.all([listQuestions(), listDocs()])
    return { questions, docs }
  })

  if (loaded.loading && !loaded.data) return <Loading />
  if (!loaded.data) return <ErrorNote error={loaded.error} />
  const { questions, docs } = loaded.data

  const mine = (id: string) => messages.some((m) => m.question_id === id && m.author_id === me.id)
  const answeredAtAll = (id: string) => messages.some((m) => m.question_id === id)
  const open = questions.filter((q) => q.status === 'open')
  const waiting = open.filter((q) => (me.role === 'client' ? !mine(q.id) : !answeredAtAll(q.id)))
  const rest = questions.filter((q) => !waiting.includes(q))
  const docOf = (id: string | null) => docs.find((d) => d.id === id)

  const list = (items: typeof questions) =>
    items.map((q) => {
      const doc = docOf(q.document_id)
      return (
        <div key={q.id}>
          <QuestionCard question={q} number={questions.indexOf(q) + 1} />
          {doc && (
            <p className="muted sans small from-doc">
              From <Link to={doc.kind === 'weekly' ? `/reports/${doc.slug}` : '/blueprint'}>{doc.title}</Link>
            </p>
          )}
        </div>
      )
    })

  return (
    <>
      <PageHead
        eyebrow="Celestial Companions"
        title="Questions"
        byline={me.role === 'client' ? 'Everything I have asked you, in one place.' : 'Every question, and the answers as they come in.'}
      />

      <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>{me.role === 'client' ? 'Waiting for you' : 'Waiting for an answer'}</h2>
      {waiting.length === 0 ? <p className="muted">Nothing is waiting.</p> : <div>{list(waiting)}</div>}

      {rest.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.25rem' }}>Answered or closed</h2>
          <div>{list(rest)}</div>
        </>
      )}
    </>
  )
}
