// Every database name used by this portal starts with "ccom_", so it cannot clash with anything else
// living in the same Supabase project.
export const T = {
  profiles: 'ccom_profiles',
  documents: 'ccom_documents',
  questions: 'ccom_questions',
  decisions: 'ccom_decisions',
  updates: 'ccom_updates',
  settings: 'ccom_settings',
  messages: 'ccom_messages',
} as const
