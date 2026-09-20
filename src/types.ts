export type Role = 'owner' | 'client' | 'viewer'

export interface Profile {
  id: string
  display_name: string
  role: Role
}

export interface Doc {
  id: string
  kind: 'blueprint' | 'weekly' | 'page'
  slug: string
  title: string
  summary: string | null
  body_md: string
  pinned: boolean
  period_start: string | null
  period_end: string | null
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  document_id: string | null
  key: string
  prompt: string
  why: string | null
  note: string | null
  position: number
  status: 'open' | 'closed'
}

export interface Decision {
  id: string
  title: string
  detail: string | null
  status: 'open' | 'decided' | 'parked'
  outcome: string | null
  decided_on: string | null
  needed_by: string | null
  position: number
}

export interface UpdateEntry {
  id: string
  title: string
  summary: string
  details_md: string
  released_on: string
  version: string | null
  demo_url: string | null
  status: 'draft' | 'published'
}

export interface Message {
  id: string
  question_id: string | null
  document_id: string | null
  parent_id: string | null
  author_id: string
  body: string
  created_at: string
  updated_at: string | null
}

export type Settings = Record<string, string>
