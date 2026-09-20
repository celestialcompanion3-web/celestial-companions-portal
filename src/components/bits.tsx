import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Decision, Doc, Question } from '../types'

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <p className="loading">{text}</p>
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null
  return (
    <p className="notice error" role="alert">
      {error}
    </p>
  )
}

export function PageHead({ eyebrow, title, byline, children }: { eyebrow?: string; title: string; byline?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {byline && <p className="byline">{byline}</p>}
      {children}
    </header>
  )
}

export function SectionTitle({ title, to, linkText }: { title: string; to?: string; linkText?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {to && <Link to={to}>{linkText ?? 'See all'}</Link>}
    </div>
  )
}

export function DocStatusPill({ doc }: { doc: Doc }) {
  return doc.status === 'draft' ? <span className="pill warn">Draft</span> : null
}

export function DecisionPill({ status }: { status: Decision['status'] }) {
  if (status === 'decided') return <span className="pill good">Decided</span>
  if (status === 'parked') return <span className="pill">Parked</span>
  return <span className="pill warn">Open</span>
}

export function QuestionPill({ status }: { status: Question['status'] }) {
  return status === 'closed' ? <span className="pill good">Closed</span> : null
}
