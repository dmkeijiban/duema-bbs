-- duema-bbs initial comment recovery helper
-- READ ONLY: run this only against a restored/cloned Supabase project.
-- Do not run restore/update/delete/insert statements against production.

-- 1) Basic restored DB counts.
select
  (select count(*) from public.threads) as threads_count,
  (select count(*) from public.posts) as posts_count,
  (select count(*) from public.posts where coalesce(is_deleted, false) = true) as deleted_posts_count;

-- 2) Exportable posts dataset.
-- Supabase SQL Editor can download the result as CSV.
select
  p.id as original_post_id,
  p.thread_id,
  t.title as thread_title,
  p.post_number,
  p.author_name,
  p.body,
  p.created_at,
  coalesce(p.is_deleted, false) as is_deleted,
  t.created_at as thread_created_at,
  t.last_posted_at as thread_last_posted_at,
  t.post_count as restored_thread_post_count
from public.posts p
left join public.threads t on t.id = p.thread_id
order by p.thread_id asc, p.post_number asc, p.id asc;

-- 3) Candidate posts that are useful for the 2026-05-02 incident.
-- This is intentionally broad: extract from before and shortly after the suspected deletion.
select
  p.id as original_post_id,
  p.thread_id,
  t.title as thread_title,
  p.post_number,
  p.author_name,
  p.body,
  p.created_at,
  coalesce(p.is_deleted, false) as is_deleted
from public.posts p
left join public.threads t on t.id = p.thread_id
where p.created_at < timestamptz '2026-05-03 00:00:00+09'
order by p.thread_id asc, p.post_number asc, p.id asc;

-- 4) Threads with evidence of missing posts in the restored snapshot.
select
  t.id as thread_id,
  t.title,
  t.created_at,
  t.last_posted_at,
  t.post_count,
  count(p.id) filter (where coalesce(p.is_deleted, false) = false) as active_posts_count
from public.threads t
left join public.posts p on p.thread_id = t.id
group by t.id, t.title, t.created_at, t.last_posted_at, t.post_count
having
  t.post_count <> count(p.id) filter (where coalesce(p.is_deleted, false) = false)
  or (
    t.last_posted_at is not null
    and t.created_at is not null
    and t.last_posted_at <> t.created_at
    and count(p.id) filter (where coalesce(p.is_deleted, false) = false) = 0
  )
order by t.id asc;
