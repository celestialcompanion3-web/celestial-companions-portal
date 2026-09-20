-- OPTIONAL. Brings the answers and comments already saved on the old public report page into this
-- portal, so the client sees them again under her own sign-in.
--
-- The old page kept them in a table called reports_site_comments. That table is shared with another
-- site, so this file only READS it, and only rows whose report starts with "ccom-". It never changes
-- or removes anything there.
--
-- It works in two steps, because the old data and this portal are in different Supabase projects:
--
--   STEP A: run the query below in the OLD project's SQL editor. It only reads. It produces one cell of
--           text: a ready-made script.
--   STEP B: copy that cell, paste it into the NEW project's SQL editor and run it. Do this after
--           schema.sql, seed.sql and members.sql. It is safe to run again: nothing is added twice.
--
-- Answers become her answers, the old owner replies become replies from the owner, and comments that
-- were not tied to a question become comments on the Blueprint.

-- ===== STEP A: run this in the OLD project =====
with c as (
  select * from public.reports_site_comments where report like 'ccom-%'
)
select string_agg(s, E'\n' order by ord) as copy_script
from (
  -- an answer to a question
  select created_at as ord,
         format(
           'insert into public.ccom_messages (question_id, author_id, body, created_at, updated_at) '
           || 'select q.id, p.id, %L, %L::timestamptz, %L::timestamptz '
           || 'from public.ccom_questions q cross join (select id from public.ccom_profiles where role = ''client'' order by created_at limit 1) p '
           || 'where q.key = %L on conflict do nothing;',
           body, created_at, updated_at, question_key) as s
  from c where question_key is not null
  union all
  -- the owner's reply to that answer
  select replied_at,
         format(
           'insert into public.ccom_messages (parent_id, author_id, body, created_at) '
           || 'select m.id, o.id, %L, %L::timestamptz '
           || 'from public.ccom_messages m '
           || 'join public.ccom_questions q on q.id = m.question_id '
           || 'join public.ccom_profiles cl on cl.id = m.author_id and cl.role = ''client'' '
           || 'cross join (select id from public.ccom_profiles where role = ''owner'' order by created_at limit 1) o '
           || 'where q.key = %L and not exists (select 1 from public.ccom_messages r where r.parent_id = m.id and r.author_id = o.id and r.body = %L);',
           reply, coalesce(replied_at, created_at), question_key, reply)
  from c where question_key is not null and reply is not null
  union all
  -- a comment that was not tied to a question
  select created_at,
         format(
           'insert into public.ccom_messages (document_id, author_id, body, created_at, updated_at) '
           || 'select d.id, p.id, %L, %L::timestamptz, %L::timestamptz '
           || 'from public.ccom_documents d cross join (select id from public.ccom_profiles where role = ''client'' order by created_at limit 1) p '
           || 'where d.slug = ''blueprint'' and not exists (select 1 from public.ccom_messages x where x.document_id = d.id and x.author_id = p.id and x.body = %L);',
           body, created_at, updated_at, body)
  from c where question_key is null
) t;

-- ===== STEP B: paste the result of STEP A into the NEW project's SQL editor and run it =====
-- Then check it there with:
--   select q.key, left(m.body, 60) as answer from public.ccom_messages m
--   join public.ccom_questions q on q.id = m.question_id order by q.position;
