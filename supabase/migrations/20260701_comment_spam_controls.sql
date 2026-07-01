-- Emergency comment spam controls.
-- Apply before enabling IP-based rate limits and per-thread comment locks in production.

alter table public.posts
  add column if not exists ip_hash text;

alter table public.threads
  add column if not exists comment_locked boolean not null default false;

create index if not exists idx_posts_ip_hash_created_at
  on public.posts(ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists idx_threads_comment_locked
  on public.threads(comment_locked)
  where comment_locked = true;
