// Tests copy-old-answers.sql, cleanup-old-comments.sql and the safety check at the top of schema.sql,
// on local Postgres (PGlite) only. Nothing here talks to a real database.
// Run with:  npm run test:db
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(here, '..', f), 'utf8')

let failed = 0
const check = (name, ok, detail) => {
  if (!ok) failed++
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   -> ' + detail))
}

const OWNER = '11111111-1111-4111-8111-111111111111'
const CLIENT = '22222222-2222-4222-8222-222222222222'

const supabaseStandIn = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

// ---------- the OLD project: a shared comments table with two sites' rows in it ----------
const old = new PGlite()
await old.exec(`
  create table public.reports_site_comments (
    id uuid primary key default gen_random_uuid(),
    report text not null, question_key text, author_name text, body text not null,
    reader_token uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now(), updated_at timestamptz,
    reply text, replied_at timestamptz
  );
  insert into public.reports_site_comments (report, question_key, body, created_at, updated_at, reply, replied_at) values
    ('ccom-blueprint', 'q1', 'Two weeks is fine, I''d say.', '2026-09-15 10:00+00', '2026-09-16 09:00+00', 'Thank you, that helps.', '2026-09-16 12:00+00'),
    ('ccom-blueprint', 'q3', 'A private link please.', '2026-09-15 11:00+00', null, null, null),
    ('ccom-blueprint', null,  'A general thought about the plan.', '2026-09-15 12:00+00', null, null, null),
    ('other-site',     'q1', 'Belongs to a different site and must not move.', '2026-09-15 13:00+00', null, 'A reply that must stay put.', '2026-09-15 14:00+00');
`)

const file = read('copy-old-answers.sql')
const stepA = file.slice(file.indexOf('with c as ('), file.indexOf('-- ===== STEP B'))
const before = (await old.query(`select count(*)::int n from public.reports_site_comments`)).rows[0].n
const script = (await old.query(stepA)).rows[0].copy_script
const after = (await old.query(`select count(*)::int n from public.reports_site_comments`)).rows[0].n
check('step A produces a script and only reads the old table', typeof script === 'string' && script.length > 0 && before === after, String(script))
check('step A leaves the other site\'s rows out of the script', !/must not move|must stay put/.test(script), script)

// ---------- the NEW project ----------
const fresh = new PGlite()
await fresh.exec(supabaseStandIn)
await fresh.exec(`insert into auth.users (id, email) values ('${OWNER}', 'owner@example.com'), ('${CLIENT}', 'client@example.com')`)
await fresh.exec(read('schema.sql'))
await fresh.exec(read('seed.sql'))
await fresh.exec(
  read('members.sql')
    .replace('REPLACE-WITH-YOUR-EMAIL', 'owner@example.com').replace('REPLACE-WITH-YOUR-NAME', 'Owner')
    .replace('REPLACE-WITH-CLIENT-EMAIL', 'client@example.com').replace('REPLACE-WITH-CLIENT-NAME', 'Client'),
)

await fresh.exec(script)
await fresh.exec(script) // running it again must not add anything twice
const messages = (
  await fresh.query(`
    select q.key, m.author_id, m.body, m.updated_at is not null as edited, m.parent_id is not null as is_reply,
           (select body from ccom_messages r where r.parent_id = m.id) as reply
    from ccom_messages m left join ccom_questions q on q.id = m.question_id
    where m.parent_id is null order by m.created_at`)
).rows
check('two answers and one comment arrive, once each', messages.length === 3, JSON.stringify(messages))
const q1 = messages.find((m) => m.key === 'q1')
check('the answer belongs to the client, with its edited time', q1?.author_id === CLIENT && q1.edited === true && q1.body === "Two weeks is fine, I'd say.", JSON.stringify(q1))
check('the old reply becomes a reply from the owner', q1?.reply === 'Thank you, that helps.', JSON.stringify(q1))
const replyAuthor = (await fresh.query(`select author_id from ccom_messages where parent_id is not null`)).rows
check('there is exactly one reply, written by the owner', replyAuthor.length === 1 && replyAuthor[0].author_id === OWNER, JSON.stringify(replyAuthor))
const comment = (await fresh.query(`select d.slug, m.body from ccom_messages m join ccom_documents d on d.id = m.document_id`)).rows
check('the general comment lands on the Blueprint', comment.length === 1 && comment[0].slug === 'blueprint', JSON.stringify(comment))

// ---------- the cleanup file only ever touches "ccom-" rows ----------
const cleanup = read('cleanup-old-comments.sql')
check('cleanup file filters on report like \'ccom-%\'', /where report like 'ccom-%'/.test(cleanup))
check('cleanup file never drops or alters anything', !/\b(drop|alter|truncate)\b/i.test(cleanup.replace(/--.*$/gm, '')), cleanup)
await old.exec(cleanup.replace(/^--.*$/gm, ''))
const left = (await old.query(`select report, count(*)::int n from public.reports_site_comments group by report`)).rows
check('after cleanup only the other site\'s row is left, untouched', left.length === 1 && left[0].report === 'other-site' && left[0].n === 1, JSON.stringify(left))
const untouched = (await old.query(`select reply from public.reports_site_comments`)).rows[0].reply
check('the other site\'s reply is unchanged', untouched === 'A reply that must stay put.', untouched)

// ---------- the safety check in schema.sql ----------
const older = new PGlite()
await older.exec(supabaseStandIn)
await older.exec(`create table public.ccom_answers (id uuid primary key)`)
let refused = ''
try {
  await older.exec(read('schema.sql'))
} catch (e) {
  refused = String(e.message)
}
check('schema.sql refuses to run beside tables from the older version', /new Supabase project/.test(refused), refused)

if (failed) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll migration checks passed.')
