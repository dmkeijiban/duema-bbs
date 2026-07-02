-- Kakolog / auto archive controls.
-- Old threads stay readable. These flags only control comment posting and list placement.

alter table public.threads
  add column if not exists auto_lock_exempt boolean not null default false,
  add column if not exists archived_at timestamptz;

update public.threads
  set archived_at = coalesce(archived_at, now())
  where is_archived = true
    and archived_at is null;

create index if not exists idx_threads_auto_archive_candidates
  on public.threads(created_at desc)
  where is_archived = false and archived_at is null and auto_lock_exempt = false;

create index if not exists idx_threads_archived_created_at
  on public.threads(created_at desc)
  where is_archived = true or archived_at is not null;

create index if not exists idx_threads_kakolog_category_created_at
  on public.threads(category_id, created_at desc)
  where is_archived = true or archived_at is not null or auto_lock_exempt = false;
