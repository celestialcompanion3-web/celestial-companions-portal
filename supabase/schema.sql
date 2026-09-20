-- Celestial Companions Portal: tables, access rules and helper functions.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is safe to run again.
--
-- Everything here starts with "ccom_", so it cannot clash with anything else in the same project.
--
-- Who can do what:
--   owner   runs the portal. Edits everything, replies, and writes comments.
--   client  the person the work is for. Reads everything published, answers questions, comments.
--   viewer  reads everything published and cannot write.
-- Nobody without a row in ccom_profiles can read anything. Sign-ups are switched off in
-- Authentication settings, so only people created in the dashboard can ever sign in.

-- ---------- safety check ----------
-- An earlier draft of this portal used some of the same table names with a different layout. If this
-- project has those tables, stop here instead of quietly mixing the two. Use a new Supabase project.
do $check$
begin
  if to_regclass('public.ccom_answers') is not null
     or to_regclass('public.ccom_demos') is not null
     or to_regclass('public.ccom_weekly_reports') is not null then
    raise exception 'This project already has tables from an older version of the portal. Please run this in a new Supabase project.';
  end if;
end
$check$;

-- ---------- people ----------
create table if not exists public.ccom_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role         text not null check (role in ('owner', 'client', 'viewer')),
  created_at   timestamptz not null default now()
);

-- Helper functions. They run with elevated rights so the rules below can ask "who is this?"
-- without the rules on ccom_profiles asking themselves in a loop.
create or replace function public.ccom_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.ccom_profiles where id = auth.uid();
$$;

create or replace function public.ccom_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ccom_profiles where id = auth.uid());
$$;

create or replace function public.ccom_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from public.ccom_profiles where id = auth.uid()), false);
$$;

create or replace function public.ccom_can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner', 'client') from public.ccom_profiles where id = auth.uid()), false);
$$;

revoke all on function public.ccom_my_role(), public.ccom_is_member(), public.ccom_is_owner(), public.ccom_can_write() from public, anon;
grant execute on function public.ccom_my_role(), public.ccom_is_member(), public.ccom_is_owner(), public.ccom_can_write() to authenticated;

create or replace function public.ccom_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- documents: the blueprint, weekly reports and other pages ----------
create table if not exists public.ccom_documents (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('blueprint', 'weekly', 'page')),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  title        text not null check (char_length(btrim(title)) > 0),
  summary      text,
  body_md      text not null default '',
  pinned       boolean not null default false,
  period_start date,
  period_end   date,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.ccom_stamp_published()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists ccom_documents_stamp_published on public.ccom_documents;
create trigger ccom_documents_stamp_published before insert or update on public.ccom_documents
  for each row execute function public.ccom_stamp_published();
drop trigger if exists ccom_documents_touch on public.ccom_documents;
create trigger ccom_documents_touch before update on public.ccom_documents
  for each row execute function public.ccom_touch_updated_at();

-- ---------- questions for the client ----------
-- "note" records an answer that arrived outside the portal, for example by email.
create table if not exists public.ccom_questions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references public.ccom_documents (id) on delete set null,
  key         text not null unique check (key ~ '^[a-z0-9-]{1,40}$'),
  prompt      text not null check (char_length(btrim(prompt)) > 0),
  why         text,
  note        text,
  position    integer not null default 0,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists ccom_questions_touch on public.ccom_questions;
create trigger ccom_questions_touch before update on public.ccom_questions
  for each row execute function public.ccom_touch_updated_at();

-- ---------- decisions: made, still open, or parked ----------
create table if not exists public.ccom_decisions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) > 0),
  detail     text,
  status     text not null default 'open' check (status in ('open', 'decided', 'parked')),
  outcome    text,
  decided_on date,
  needed_by  date,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ccom_decisions_touch on public.ccom_decisions;
create trigger ccom_decisions_touch before update on public.ccom_decisions
  for each row execute function public.ccom_touch_updated_at();

-- ---------- updates: one entry per finished major update ----------
create table if not exists public.ccom_updates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) > 0),
  summary     text not null check (char_length(btrim(summary)) > 0),
  details_md  text not null default '',
  released_on date not null default current_date,
  version     text,
  demo_url    text check (demo_url is null or demo_url ~ '^https://'),
  status      text not null default 'published' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists ccom_updates_touch on public.ccom_updates;
create trigger ccom_updates_touch before update on public.ccom_updates
  for each row execute function public.ccom_touch_updated_at();

-- ---------- settings: the live demo's address, version, date and note ----------
create table if not exists public.ccom_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  value      text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists ccom_settings_touch on public.ccom_settings;
create trigger ccom_settings_touch before update on public.ccom_settings
  for each row execute function public.ccom_touch_updated_at();

-- ---------- messages: answers, comments and replies ----------
-- An answer belongs to a question. A comment belongs to a document. A reply belongs to another
-- message. Every message belongs to exactly one of the three.
create table if not exists public.ccom_messages (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid references public.ccom_questions (id) on delete cascade,
  document_id uuid references public.ccom_documents (id) on delete cascade,
  parent_id   uuid references public.ccom_messages (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.ccom_profiles (id),
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  check (num_nonnulls(question_id, document_id, parent_id) = 1)
);

create index if not exists ccom_messages_question_idx on public.ccom_messages (question_id);
create index if not exists ccom_messages_document_idx on public.ccom_messages (document_id);
create index if not exists ccom_messages_parent_idx on public.ccom_messages (parent_id);

-- One answer per person per question. Changing an answer edits that row.
create unique index if not exists ccom_messages_one_answer_per_author
  on public.ccom_messages (question_id, author_id) where question_id is not null;

-- An edit may change the words and nothing else. The edited time is stamped only when the words change.
create or replace function public.ccom_messages_guard()
returns trigger language plpgsql as $$
begin
  if new.author_id is distinct from old.author_id
     or new.question_id is distinct from old.question_id
     or new.document_id is distinct from old.document_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'only the text of a message can be changed';
  end if;
  if new.body is distinct from old.body then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists ccom_messages_guard on public.ccom_messages;
create trigger ccom_messages_guard before update on public.ccom_messages
  for each row execute function public.ccom_messages_guard();

-- ---------- access rules ----------
alter table public.ccom_profiles  enable row level security;
alter table public.ccom_documents enable row level security;
alter table public.ccom_questions enable row level security;
alter table public.ccom_decisions enable row level security;
alter table public.ccom_updates   enable row level security;
alter table public.ccom_settings  enable row level security;
alter table public.ccom_messages  enable row level security;

-- Start from nothing (Supabase hands out broad rights to new tables by default, including
-- delete), then give back only what is needed. The rules below decide which rows those rights
-- apply to. Messages get no delete right at all.
revoke all on public.ccom_profiles, public.ccom_documents, public.ccom_questions, public.ccom_decisions,
              public.ccom_updates, public.ccom_settings, public.ccom_messages from anon, authenticated;
grant select on public.ccom_profiles to authenticated;
grant select, insert, update, delete on public.ccom_documents, public.ccom_questions, public.ccom_decisions,
              public.ccom_updates, public.ccom_settings to authenticated;
grant select, insert, update on public.ccom_messages to authenticated;

-- profiles: any member can see who is who. Nobody can change profiles from the site.
drop policy if exists "members read profiles" on public.ccom_profiles;
create policy "members read profiles" on public.ccom_profiles
  for select to authenticated using (public.ccom_is_member());

-- documents: drafts are visible to the owner only
drop policy if exists "members read published documents" on public.ccom_documents;
create policy "members read published documents" on public.ccom_documents
  for select to authenticated using (public.ccom_is_member() and (status = 'published' or public.ccom_is_owner()));
drop policy if exists "owner writes documents" on public.ccom_documents;
create policy "owner writes documents" on public.ccom_documents
  for all to authenticated using (public.ccom_is_owner()) with check (public.ccom_is_owner());

-- questions
drop policy if exists "members read questions" on public.ccom_questions;
create policy "members read questions" on public.ccom_questions
  for select to authenticated using (public.ccom_is_member());
drop policy if exists "owner writes questions" on public.ccom_questions;
create policy "owner writes questions" on public.ccom_questions
  for all to authenticated using (public.ccom_is_owner()) with check (public.ccom_is_owner());

-- decisions
drop policy if exists "members read decisions" on public.ccom_decisions;
create policy "members read decisions" on public.ccom_decisions
  for select to authenticated using (public.ccom_is_member());
drop policy if exists "owner writes decisions" on public.ccom_decisions;
create policy "owner writes decisions" on public.ccom_decisions
  for all to authenticated using (public.ccom_is_owner()) with check (public.ccom_is_owner());

-- updates: drafts are visible to the owner only
drop policy if exists "members read published updates" on public.ccom_updates;
create policy "members read published updates" on public.ccom_updates
  for select to authenticated using (public.ccom_is_member() and (status = 'published' or public.ccom_is_owner()));
drop policy if exists "owner writes updates" on public.ccom_updates;
create policy "owner writes updates" on public.ccom_updates
  for all to authenticated using (public.ccom_is_owner()) with check (public.ccom_is_owner());

-- settings
drop policy if exists "members read settings" on public.ccom_settings;
create policy "members read settings" on public.ccom_settings
  for select to authenticated using (public.ccom_is_member());
drop policy if exists "owner writes settings" on public.ccom_settings;
create policy "owner writes settings" on public.ccom_settings
  for all to authenticated using (public.ccom_is_owner()) with check (public.ccom_is_owner());

-- messages: members read everything. Owner and client write as themselves and edit only their own.
-- An answer needs an open question.
drop policy if exists "members read messages" on public.ccom_messages;
create policy "members read messages" on public.ccom_messages
  for select to authenticated using (public.ccom_is_member());

drop policy if exists "writers add their own messages" on public.ccom_messages;
create policy "writers add their own messages" on public.ccom_messages
  for insert to authenticated
  with check (
    public.ccom_can_write()
    and author_id = auth.uid()
    and (question_id is null or exists (select 1 from public.ccom_questions q where q.id = question_id and q.status = 'open'))
  );

drop policy if exists "authors edit their own messages" on public.ccom_messages;
create policy "authors edit their own messages" on public.ccom_messages
  for update to authenticated
  using (author_id = auth.uid() and public.ccom_can_write())
  with check (author_id = auth.uid() and public.ccom_can_write());
