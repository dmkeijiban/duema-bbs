alter table public.threads
  add column if not exists thumbnail_url text;

alter table public.posts
  add column if not exists thumbnail_url text;
