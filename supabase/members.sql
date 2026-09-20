-- Gives the people you created in Authentication > Users their place in the portal.
--
-- Before running this:
--   1. In Supabase, go to Authentication > Users > Add user > Create new user.
--      Create one user for yourself and one for the client. Tick "Auto Confirm User".
--   2. Replace the four REPLACE-WITH-... values below with the real emails and the names you want
--      shown. Do this in the SQL editor, not in this saved file.
--   3. Run it. It is safe to run again.
--
-- Roles:  owner = you (edits everything).  client = the person the work is for (answers, comments, reads).
--         viewer = read-only, for anyone added later.

insert into public.ccom_profiles (id, display_name, role)
select id, 'REPLACE-WITH-YOUR-NAME', 'owner' from auth.users where email = 'REPLACE-WITH-YOUR-EMAIL'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

insert into public.ccom_profiles (id, display_name, role)
select id, 'REPLACE-WITH-CLIENT-NAME', 'client' from auth.users where email = 'REPLACE-WITH-CLIENT-EMAIL'
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

-- To add someone later (read-only), create their user first, then:
--   insert into public.ccom_profiles (id, display_name, role)
--   select id, 'Their Name', 'viewer' from auth.users where email = 'their-email';

-- Check: this should list both people with the right role.
select p.display_name, p.role, u.email
from public.ccom_profiles p join auth.users u on u.id = p.id
order by p.role;
