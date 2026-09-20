import { DecisionPill, ErrorNote, Loading, PageHead } from '../components/bits'
import { useLoad } from '../lib/data'
import { formatDate } from '../lib/format'
import { listDecisions } from '../lib/queries'
import type { Decision } from '../types'

function Item({ d }: { d: Decision }) {
  return (
    <div className="decision">
      <div className="decision-top">
        <h3>{d.title}</h3>
        <DecisionPill status={d.status} />
      </div>
      {d.outcome && <p className="outcome">{d.outcome}</p>}
      {d.detail && <p>{d.detail}</p>}
      <p className="meta">
        {d.status === 'decided' && d.decided_on && `Decided ${formatDate(d.decided_on)}`}
        {d.status === 'open' && d.needed_by && `Needed by ${formatDate(d.needed_by)}`}
      </p>
    </div>
  )
}

export function Decisions() {
  const loaded = useLoad(listDecisions)
  if (loaded.loading && !loaded.data) return <Loading />
  if (!loaded.data) return <ErrorNote error={loaded.error} />
  const all = loaded.data

  const groups: Array<[string, Decision[]]> = [
    ['Still to decide', all.filter((d) => d.status === 'open')],
    ['Decided', all.filter((d) => d.status === 'decided')],
    ['Parked for later', all.filter((d) => d.status === 'parked')],
  ]

  return (
    <>
      <PageHead eyebrow="Celestial Companions" title="Decisions" byline="What has been settled, what is still waiting on a choice, and what is parked for later." />
      {groups.map(([title, items], i) =>
        items.length === 0 ? null : (
          <section key={title}>
            <h2 style={{ fontSize: '1.25rem', marginTop: i === 0 ? 0 : '2.5rem' }}>{title}</h2>
            {items.map((d) => (
              <Item key={d.id} d={d} />
            ))}
          </section>
        ),
      )}
      {all.length === 0 && <p className="muted">No decisions have been added yet.</p>}
    </>
  )
}
