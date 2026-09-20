-- OPTIONAL, AND ONLY FOR LATER. Removes this project's old comments from the shared table, once the
-- client is using the new portal and her answers have been copied across (copy-old-answers.sql).
--
-- Run it in the OLD project's SQL editor, not the new one.
--
-- The table reports_site_comments is shared with another site, so this file:
--   * only touches rows whose report starts with "ccom-", and
--   * never drops or alters the table, its functions, or anything else.
-- Do not widen the "like 'ccom-%'" filter.

-- 1. Look first. This only counts, and changes nothing.
select report, count(*) as rows_to_remove
from public.reports_site_comments
where report like 'ccom-%'
group by report
order by report;

-- 2. When the numbers look right, and you have a copy of what you need, run this:
delete from public.reports_site_comments
where report like 'ccom-%';
