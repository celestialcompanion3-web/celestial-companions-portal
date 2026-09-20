import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useAuth, useMe } from '../lib/auth'
import { repliesTo, useData } from '../lib/data'
import { formatDateTime } from '../lib/format'
import type { Message, Question } from '../types'
import { PenIcon } from './Icons'
import { QuestionPill } from './bits'

const MAX = 4000

// ---- a box for writing ----

interface ComposerProps {
  label: string
  placeholder?: string
  submitText: string
  initial?: string
  autoFocus?: boolean
  rows?: number
  hint?: string
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
}

function Composer({ label, placeholder, submitText, initial = '', autoFocus, rows, hint, onSubmit, onCancel }: ComposerProps) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!autoFocus || !box.current) return
    box.current.focus()
    const end = box.current.value.length
    box.current.setSelectionRange(end, end)
  }, [autoFocus])

  const empty = text.trim().length === 0
  const unchanged = initial !== '' && text.trim() === initial.trim()

  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (busy || empty || unchanged) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(text)
      if (!initial) setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Please try again.')
    }
    setBusy(false)
  }

  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void save()
    }
  }

  return (
    <form className="composer" onSubmit={save}>
      <textarea
        ref={box}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        rows={rows}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keys}
        disabled={busy}
      />
      {error && (
        <p className="notice error" role="alert" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {error}
        </p>
      )}
      <div className="composer-foot">
        <span>{hint ?? 'Ctrl + Enter to send'}</span>
        <span className="btn-row">
          {onCancel && (
            <button type="button" className="btn quiet small" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn small" disabled={busy || empty || unchanged}>
            {busy ? 'Saving…' : submitText}
          </button>
        </span>
      </div>
    </form>
  )
}

// ---- one saved message: text, who and when, and the pen ----

function MessageView({ message, canEdit, variant }: { message: Message; canEdit: boolean; variant: 'answer' | 'reply' }) {
  const me = useMe()
  const { nameOf, edit } = useData()
  const [editing, setEditing] = useState(false)
  const startEditing = () => canEdit && setEditing(true)

  const top = (
    <div className={variant === 'answer' ? 'answer-top' : 'reply-top'}>
      <span>
        <b>{nameOf(message.author_id, me.id)}</b> · {formatDateTime(message.created_at)}
        {message.updated_at && <> · Edited {formatDateTime(message.updated_at)}</>}
      </span>
      {canEdit && !editing && (
        <button type="button" className="icon-btn" onClick={startEditing} aria-label="Edit" title="Edit">
          <PenIcon />
        </button>
      )}
    </div>
  )

  const body = editing ? (
    <Composer
      label="Edit your text"
      submitText="Save changes"
      initial={message.body}
      autoFocus
      onCancel={() => setEditing(false)}
      hint="Esc to cancel · Ctrl + Enter to save"
      onSubmit={async (text) => {
        await edit(message.id, text)
        setEditing(false)
      }}
    />
  ) : (
    <p className="answer-text" onDoubleClick={startEditing}>
      {message.body}
    </p>
  )

  if (variant === 'reply') {
    return (
      <div className="reply">
        {top}
        {body}
      </div>
    )
  }
  return (
    <div className={`answer${message.author_id === me.id ? ' mine' : ''}`}>
      {top}
      {body}
    </div>
  )
}

// ---- replies under one answer or comment ----

function Replies({ root, locked }: { root: Message; locked: boolean }) {
  const me = useMe()
  const { canWrite } = useAuth()
  const { messages, post } = useData()
  const [replying, setReplying] = useState(false)
  const replies = repliesTo(messages, root.id)

  return (
    <div className="replies-block">
      {replies.length > 0 && (
        <div className="replies">
          {replies.map((r) => (
            <MessageView key={r.id} message={r} canEdit={canWrite && !locked && r.author_id === me.id} variant="reply" />
          ))}
        </div>
      )}
      {canWrite &&
        (replying ? (
          <div className="replies">
            <Composer
              label="Write a reply"
              submitText="Send reply"
              autoFocus
              rows={3}
              onCancel={() => setReplying(false)}
              onSubmit={async (text) => {
                await post({ parent_id: root.id, body: text })
                setReplying(false)
              }}
            />
          </div>
        ) : (
          <div className="reply-start">
            <button type="button" className="link-btn" onClick={() => setReplying(true)}>
              Reply
            </button>
          </div>
        ))}
    </div>
  )
}

// ---- a question with its answers ----

export function QuestionCard({ question, number }: { question: Question; number: number }) {
  const me = useMe()
  const { canWrite } = useAuth()
  const { messages, post } = useData()
  const open = question.status === 'open'
  const answers = messages.filter((m) => m.question_id === question.id)
  const mine = answers.find((a) => a.author_id === me.id)
  // Only the person being asked (the client) gets an answer box. The owner replies underneath instead.
  const canAnswer = open && canWrite && me.role === 'client' && !mine

  return (
    <section className="question" aria-labelledby={`q-${question.id}`}>
      <div className="q-head">
        <span className="q-num">{number}</span>
        <h3 className="q-prompt" id={`q-${question.id}`}>
          {question.prompt} <QuestionPill status={question.status} />
        </h3>
      </div>
      {question.why && <p className="q-why">{question.why}</p>}

      {question.note && (
        <div className="q-note">
          <b>Answer</b>
          {question.note}
        </div>
      )}

      <div className="q-body">
        {answers.map((a) => (
          <div key={a.id}>
            <MessageView message={a} canEdit={open && canWrite && a.author_id === me.id} variant="answer" />
            <Replies root={a} locked={!open} />
            {open && canWrite && a.author_id === me.id && <p className="answer-edit-hint">Double-click your answer, or use the pen, to change it.</p>}
          </div>
        ))}

        {canAnswer && (
          <Composer
            label={`Your answer to: ${question.prompt}`}
            placeholder="Type your answer here"
            submitText="Save answer"
            rows={4}
            onSubmit={(text) => post({ question_id: question.id, body: text })}
          />
        )}

        {answers.length === 0 && !canAnswer && open && <p className="muted sans small">No answer yet.</p>}
        {answers.length === 0 && !open && !question.note && <p className="muted sans small">This question is closed.</p>}
      </div>
    </section>
  )
}

// ---- comments on a whole page ----

export function CommentThread({ documentId }: { documentId: string }) {
  const { canWrite } = useAuth()
  const me = useMe()
  const { messages, post } = useData()
  const comments = messages.filter((m) => m.document_id === documentId)

  return (
    <section aria-labelledby="comments-title" className="thread">
      <h2 className="thread-title" id="comments-title">
        Comments on this page
      </h2>
      <p className="muted sans small" style={{ marginTop: 0 }}>
        Anything else you want to say about this page that is not one of the questions.
      </p>
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <MessageView message={c} canEdit={canWrite && c.author_id === me.id} variant="answer" />
          <Replies root={c} locked={false} />
        </div>
      ))}
      {comments.length === 0 && !canWrite && <p className="muted sans small">No comments yet.</p>}
      {canWrite && (
        <Composer label="Add a comment" placeholder="Add a comment" submitText="Post comment" rows={3} onSubmit={(text) => post({ document_id: documentId, body: text })} />
      )}
    </section>
  )
}
