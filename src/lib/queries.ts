import { rows, supabase } from './supabase'
import { T } from './tables'
import type { Decision, Doc, Question, Settings, UpdateEntry } from '../types'

export const listDocs = (kind?: Doc['kind']) => {
  let q = supabase.from(T.documents).select('*')
  if (kind) q = q.eq('kind', kind)
  return rows<Doc>(q.order('published_at', { ascending: false, nullsFirst: true }))
}

export const getDoc = async (kind: Doc['kind'], slug?: string) => {
  let q = supabase.from(T.documents).select('*').eq('kind', kind)
  if (slug) q = q.eq('slug', slug)
  const list = await rows<Doc>(q.order('pinned', { ascending: false }).limit(1))
  return list[0] ?? null
}

export const listQuestions = () =>
  rows<Question>(supabase.from(T.questions).select('*').order('position', { ascending: true }))

export const listDecisions = () =>
  rows<Decision>(supabase.from(T.decisions).select('*').order('position', { ascending: true }))

export const listUpdates = () =>
  rows<UpdateEntry>(supabase.from(T.updates).select('*').order('released_on', { ascending: false }).order('created_at', { ascending: false }))

export async function getSettings(): Promise<Settings> {
  const list = await rows<{ key: string; value: string }>(supabase.from(T.settings).select('*'))
  return Object.fromEntries(list.map((r) => [r.key, r.value]))
}
