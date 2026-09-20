// Tests the database rules on a local Postgres (PGlite), with a stand-in for Supabase's sign-in.
// Run with:  npm run test:db
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(here, '..', f), 'utf8')

const OWNER = '11111111-1111-4111-8111-111111111111'
const CLIENT = '22222222-2222-4222-8222-222222222222'
const VIEWER = '33333333-3333-4333-8333-333333333333'
const STRANGER = '44444444-4444-4444-8444-444444444444'

const db = new PGlite()

// Supabase gives the "anon" and "authenticated" roles rights on every new table and function by
// default. Recreate that first, so the schema has to take the rights away itself.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  insert into auth.users (id, email) values
    ('${OWNER}', 'owner@example.com'), ('${CLIENT}', 'client@example.com'),
    ('${VIEWER}', 'viewer@example.com'), ('${STRANGER}', 'stranger@example.com');
`)

let failed = 0
const check = (name, ok, detail) => {
  if (!ok) failed++
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   -> ' + detail))
}

const schema = read('schema.sql')
await db.exec(schema)
await db.exec(schema) // running it twice must be harmless
check('schema.sql runs, and runs again without error', true)

// The real seed and the real members template, exactly as they would be run.
const seed = read('seed.sql')
await db.exec(seed)
await db.exec(seed)
const counts = await db.query(`select
  (select count(*)::int from ccom_documents) docs, (select count(*)::int from ccom_questions) qs,
  (select count(*)::int from ccom_decisions) decs, (select count(*)::int from ccom_updates) ups,
  (select count(*)::int from ccom_settings) sets`)
check('seed.sql runs twice without duplicating anything', counts.rows[0].docs === 2 && counts.rows[0].qs === 4 && counts.rows[0].decs === 8 && counts.rows[0].ups === 7 && counts.rows[0].sets === 4, JSON.stringify(counts.rows[0]))

await db.exec(`update ccom_documents set title = 'Edited in the portal' where slug = 'blueprint';
               update ccom_questions set prompt = 'Edited question' where key = 'q1';`)
await db.exec(seed)
const kept = await db.query(`select (select title from ccom_documents where slug = 'blueprint') t, (select prompt from ccom_questions where key = 'q1') p`)
check('running the seed again never overwrites edits', kept.rows[0].t === 'Edited in the portal' && kept.rows[0].p === 'Edited question', JSON.stringify(kept.rows[0]))
await db.exec(`update ccom_documents set title = 'Celestial Companions Blueprint' where slug = 'blueprint';
               update ccom_questions set prompt = 'How long is a family willing to wait for their companion, and what should they be able to do while they wait?' where key = 'q1';`)

const members = read('members.sql')
  .replace('REPLACE-WITH-YOUR-EMAIL', 'owner@example.com').replace('REPLACE-WITH-YOUR-NAME', 'Owner')
  .replace('REPLACE-WITH-CLIENT-EMAIL', 'client@example.com').replace('REPLACE-WITH-CLIENT-NAME', 'Client')
await db.exec(members)
await db.exec(`insert into public.ccom_profiles (id, display_name, role) values ('${VIEWER}', 'Viewer', 'viewer')`)
const who = await db.query(`select role from ccom_profiles order by role`)
check('members.sql adds an owner and a client', who.rows.map((r) => r.role).join() === 'client,owner,viewer', JSON.stringify(who.rows))

const ids = async (sql) => (await db.query(sql)).rows[0].id
const DOC = await ids(`select id from ccom_documents where slug = 'blueprint'`)
const Q1 = await ids(`select id from ccom_questions where key = 'q1'`)
const Q2 = await ids(`select id from ccom_questions where key = 'q2'`) // seeded as closed

// Run some SQL as a signed-in person (or as the public with no login), in a transaction that is rolled back.
async function as(who, sql) {
  await db.exec('begin')
  try {
    if (who === 'anon') await db.exec('set local role anon')
    else {
      await db.exec('set local role authenticated')
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who])
    }
    const res = await db.query(sql)
    return { ok: true, rows: res.rows }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  } finally {
    await db.exec('rollback')
  }
}
// Same, but keeps the changes so later steps can build on them.
async function asKeep(who, sql) {
  await db.exec('begin')
  try {
    await db.exec('set local role authenticated')
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who])
    const res = await db.query(sql)
    await db.exec('commit')
    return { ok: true, rows: res.rows }
  } catch (e) {
    await db.exec('rollback')
    return { ok: false, error: String(e.message || e) }
  }
}
const denied = (r) => !r.ok && /permission denied|row-level security|violates|only the text|unique/i.test(r.error)
const nothing = (r) => (r.ok && r.rows.length === 0) || denied(r)

const TABLES = ['profiles', 'documents', 'questions', 'decisions', 'updates', 'settings', 'messages']

// ---------- the public, and people without access ----------
for (const t of TABLES) {
  const r = await as('anon', `select * from public.ccom_${t}`)
  check(`signed-out visitor: cannot read ${t}`, !r.ok && /permission denied/.test(r.error), JSON.stringify(r))
}
for (const [label, sql] of [
  ['write a message', `insert into public.ccom_messages (document_id, body) values ('${DOC}', 'hi')`],
  ['change the blueprint', `update public.ccom_documents set title = 'x'`],
  ['delete anything', `delete from public.ccom_documents`],
]) {
  const r = await as('anon', sql)
  check(`signed-out visitor: cannot ${label}`, !r.ok && /permission denied/.test(r.error), JSON.stringify(r))
}
for (const fn of ['ccom_is_owner()', 'ccom_is_member()', 'ccom_can_write()', 'ccom_my_role()']) {
  const r = await as('anon', `select public.${fn}`)
  check(`signed-out visitor: cannot call ${fn}`, !r.ok && /permission denied/.test(r.error), JSON.stringify(r))
}
for (const t of TABLES) {
  const r = await as(STRANGER, `select * from public.ccom_${t}`)
  check(`signed in but not invited: sees nothing in ${t}`, r.ok && r.rows.length === 0, JSON.stringify(r))
}
check('signed in but not invited: cannot write a message', denied(await as(STRANGER, `insert into public.ccom_messages (document_id, body) values ('${DOC}', 'hello')`)))
check('signed in but not invited: cannot write anything else', nothing(await as(STRANGER, `insert into public.ccom_updates (title, summary) values ('x', 'y')`)))

// ---------- the client ----------
{
  const r = await as(CLIENT, `select slug from public.ccom_documents order by slug`)
  check('client: reads the published blueprint', r.ok && r.rows.some((x) => x.slug === 'blueprint'), JSON.stringify(r))
  check('client: does not see the draft weekly report', r.ok && !r.rows.some((x) => x.slug === 'week-2026-09-14'), JSON.stringify(r))
}
for (const [label, sql] of [
  ['edit a document', `update public.ccom_documents set title = 'x' where id = '${DOC}' returning id`],
  ['delete a document', `delete from public.ccom_documents where id = '${DOC}' returning id`],
  ['edit a question', `update public.ccom_questions set prompt = 'x' where id = '${Q1}' returning id`],
  ['delete a question', `delete from public.ccom_questions where id = '${Q1}' returning id`],
  ['edit a decision', `update public.ccom_decisions set title = 'x' returning id`],
  ['edit an update', `update public.ccom_updates set title = 'x' returning id`],
  ['change the demo settings', `update public.ccom_settings set value = 'x' returning key`],
  ['make themselves owner', `update public.ccom_profiles set role = 'owner' where id = '${CLIENT}' returning id`],
]) {
  const r = await as(CLIENT, sql)
  check(`client: cannot ${label}`, nothing(r), JSON.stringify(r))
}
for (const [label, sql] of [
  ['add a document', `insert into public.ccom_documents (kind, slug, title) values ('page', 'sneaky', 'x')`],
  ['add an update', `insert into public.ccom_updates (title, summary) values ('x', 'y')`],
  ['add a question', `insert into public.ccom_questions (key, prompt) values ('zz', 'x')`],
]) {
  check(`client: cannot ${label}`, denied(await as(CLIENT, sql)))
}
{
  const r = await asKeep(CLIENT, `insert into public.ccom_messages (question_id, body) values ('${Q1}', 'My answer') returning id, author_id`)
  check('client: can answer an open question, recorded as them', r.ok && r.rows[0].author_id === CLIENT, JSON.stringify(r))
}
check('client: cannot post as someone else', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, author_id, body) values ('${Q1}', '${OWNER}', 'pretending')`)))
check('client: cannot give a second answer to the same question', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, body) values ('${Q1}', 'Second')`)))
check('client: cannot answer a closed question', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, body) values ('${Q2}', 'Too late')`)))
check('client: cannot save an empty answer', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, body) values ('${Q1}', '   ')`)))
check('client: cannot save an answer over 4000 characters', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, body) values ('${Q1}', '${'x'.repeat(4001)}')`)))
check('client: a message must belong to exactly one thing (both)', denied(await as(CLIENT, `insert into public.ccom_messages (question_id, document_id, body) values ('${Q1}', '${DOC}', 'both')`)))
check('client: a message must belong to exactly one thing (none)', denied(await as(CLIENT, `insert into public.ccom_messages (body) values ('nothing')`)))
{
  const r = await asKeep(CLIENT, `update public.ccom_messages set body = 'My answer, edited' where question_id = '${Q1}' returning body, updated_at`)
  check('client: edits their own answer, and the edit is timestamped', r.ok && r.rows[0].body === 'My answer, edited' && r.rows[0].updated_at !== null, JSON.stringify(r))
  const same = await asKeep(CLIENT, `update public.ccom_messages set body = 'My answer, edited' where question_id = '${Q1}' returning updated_at`)
  const now = await db.query(`select updated_at from ccom_messages where question_id = '${Q1}'`)
  check('client: saving identical text does not change the edited time', same.ok && String(same.rows[0].updated_at) === String(now.rows[0].updated_at) && String(same.rows[0].updated_at) === String(r.rows[0].updated_at), JSON.stringify(same))
}
check('client: cannot hand their message to someone else', denied(await as(CLIENT, `update public.ccom_messages set author_id = '${OWNER}' where question_id = '${Q1}' returning id`)))
check('client: cannot move an answer to another question', denied(await as(CLIENT, `update public.ccom_messages set question_id = '${Q2}' where question_id = '${Q1}' returning id`)))
check('client: cannot change when a message was written', denied(await as(CLIENT, `update public.ccom_messages set created_at = now() - interval '1 year' where question_id = '${Q1}' returning id`)))
check('client: cannot delete messages', denied(await as(CLIENT, `delete from public.ccom_messages where question_id = '${Q1}' returning id`)))
{
  const r = await asKeep(CLIENT, `insert into public.ccom_messages (document_id, body) values ('${DOC}', 'A comment on the page') returning id`)
  check('client: can comment on a document', r.ok, JSON.stringify(r))
}

// ---------- the owner ----------
{
  const r = await as(OWNER, `select slug from public.ccom_documents`)
  check('owner: sees drafts as well', r.ok && r.rows.some((x) => x.slug === 'week-2026-09-14'), JSON.stringify(r))
}
{
  const ans = await as(OWNER, `select id, body from public.ccom_messages where question_id = '${Q1}'`)
  check("owner: can read the client's answer", ans.ok && ans.rows.length === 1, JSON.stringify(ans))
  const answerId = ans.rows[0].id
  const rep = await asKeep(OWNER, `insert into public.ccom_messages (parent_id, body) values ('${answerId}', 'Thanks, noted.') returning id, author_id`)
  check('owner: can reply under the answer, as themselves', rep.ok && rep.rows[0].author_id === OWNER, JSON.stringify(rep))
  check("owner: cannot rewrite the client's answer", nothing(await as(OWNER, `update public.ccom_messages set body = 'Rewritten' where id = '${answerId}' returning id`)))
  const seen = await as(CLIENT, `select body from public.ccom_messages where parent_id = '${answerId}'`)
  check("client: sees the owner's reply", seen.ok && seen.rows.length === 1 && seen.rows[0].body === 'Thanks, noted.', JSON.stringify(seen))
  const reply2 = await asKeep(CLIENT, `insert into public.ccom_messages (parent_id, body) values ('${rep.rows[0].id}', 'Thank you.') returning id`)
  check('client: can reply to a reply', reply2.ok, JSON.stringify(reply2))
  check('owner: cannot delete messages either', denied(await as(OWNER, `delete from public.ccom_messages returning id`)))
}
{
  const r = await asKeep(OWNER, `update public.ccom_documents set status = 'published' where slug = 'week-2026-09-14' returning published_at`)
  check('owner: publishing a draft stamps its published time', r.ok && r.rows[0].published_at !== null, JSON.stringify(r))
  const seen = await as(CLIENT, `select slug from public.ccom_documents where slug = 'week-2026-09-14'`)
  check('client: sees a report once it is published', seen.ok && seen.rows.length === 1, JSON.stringify(seen))
  await asKeep(OWNER, `update public.ccom_documents set status = 'draft' where slug = 'week-2026-09-14'`)
}
{
  const a = await asKeep(OWNER, `insert into public.ccom_documents (kind, slug, title, body_md) values ('page', 'notes', 'Notes', 'x') returning id`)
  check('owner: can add a document', a.ok, JSON.stringify(a))
  const u = await asKeep(OWNER, `update public.ccom_settings set value = 'https://demo.example.com' where key = 'prototype_url' returning value`)
  check('owner: can change the demo address', u.ok && u.rows[0].value === 'https://demo.example.com', JSON.stringify(u))
  const q = await asKeep(OWNER, `insert into public.ccom_questions (key, prompt) values ('q9', 'Another') returning id`)
  check('owner: can add a question', q.ok, JSON.stringify(q))
  const n = await asKeep(OWNER, `update public.ccom_questions set note = 'Answered by email', status = 'closed' where key = 'q9' returning note`)
  check('owner: can record an emailed answer as a note and close the question', n.ok && n.rows[0].note === 'Answered by email', JSON.stringify(n))
  const d = await asKeep(OWNER, `insert into public.ccom_decisions (title, status) values ('A new decision', 'open') returning id`)
  check('owner: can add a decision', d.ok, JSON.stringify(d))
  const bad = await as(OWNER, `insert into public.ccom_updates (title, summary, demo_url) values ('x', 'y', 'http://insecure.example')`)
  check('owner: a demo link must be https', denied(bad), JSON.stringify(bad))
  check('owner: even the owner cannot change roles from the site', nothing(await as(OWNER, `update public.ccom_profiles set role = 'client' where id = '${OWNER}' returning id`)))
  check('owner: nobody can add a person from the site', denied(await as(OWNER, `insert into public.ccom_profiles (id, display_name, role) values ('${STRANGER}', 'Sneaky', 'client')`)))
}

// ---------- a viewer ----------
{
  const r = await as(VIEWER, `select slug from public.ccom_documents`)
  check('viewer: can read published documents', r.ok && r.rows.length > 0, JSON.stringify(r))
  check('viewer: cannot write a message', denied(await as(VIEWER, `insert into public.ccom_messages (document_id, body) values ('${DOC}', 'hi')`)))
  check('viewer: cannot change anything', nothing(await as(VIEWER, `update public.ccom_documents set title = 'x' returning id`)))
}

// ---------- people ----------
{
  const r = await as(CLIENT, `select display_name, role from public.ccom_profiles order by display_name`)
  check('members can see who is who', r.ok && r.rows.length === 3, JSON.stringify(r))
}

console.log(failed === 0 ? '\nAll database checks passed.' : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
