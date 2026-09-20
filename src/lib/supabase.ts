import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Demo mode (npm run dev:demo) uses a stand-in with sample data, so the portal can be looked at
// before a database exists. In a normal build this branch is removed, and no sample data is shipped.
export const demo = import.meta.env.VITE_DEMO === '1'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = demo || Boolean(url && key)

export const supabase: SupabaseClient = demo
  ? ((await import('../demo/client')).createDemoClient() as unknown as SupabaseClient)
  : createClient(url || 'http://localhost', key || 'not-configured')

// Runs a query and returns its rows, or throws with a readable message.
export async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

// Runs a change and throws if it failed.
export async function done(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await query
  if (error) throw new Error(error.message)
}
