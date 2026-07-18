-- 思い出図鑑0時投稿のTypefully結果保存。
-- 既存の daily_zukan_thread_logs にSNS投稿結果だけを追加する。

create table if not exists public.daily_zukan_thread_logs (
  id bigint generated always as identity primary key,
  card_slug text not null,
  cycle_no integer not null default 1,
  posted_date date not null,
  thread_id bigint references public.threads(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint daily_zukan_thread_logs_posted_date_key unique (posted_date)
);

create index if not exists idx_daily_zukan_thread_logs_cycle_card
  on public.daily_zukan_thread_logs (cycle_no, card_slug);

create unique index if not exists idx_daily_zukan_thread_logs_posted_date_unique
  on public.daily_zukan_thread_logs (posted_date);

create index if not exists idx_daily_zukan_thread_logs_thread_id
  on public.daily_zukan_thread_logs (thread_id)
  where thread_id is not null;

alter table public.daily_zukan_thread_logs
  add column if not exists typefully_status text,
  add column if not exists typefully_id text,
  add column if not exists typefully_url text,
  add column if not exists typefully_scheduled_at timestamptz,
  add column if not exists typefully_error text;

create index if not exists idx_daily_zukan_thread_logs_typefully_status
  on public.daily_zukan_thread_logs (typefully_status, posted_date desc);

alter table public.daily_zukan_thread_logs enable row level security;

comment on column public.daily_zukan_thread_logs.typefully_status is
  'Typefully投稿結果: success / error / null';
comment on column public.daily_zukan_thread_logs.typefully_id is
  'Typefully draft/post ID。値がある場合は再投稿しない';
comment on column public.daily_zukan_thread_logs.typefully_error is
  'Typefully投稿失敗時の短いエラー。secret値は保存しない';
