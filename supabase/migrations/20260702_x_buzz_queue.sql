-- X話題URLストック。
-- 管理人が登録したURL文字列だけを使い、X API / OGP / スクレイピングは行わない。
-- 既存 threads/posts には触らず、thread_id で作成済みスレへ紐付ける。

create table if not exists public.x_buzz_queue (
  id bigint generated always as identity primary key,
  source_url text not null,
  status text not null default 'pending',
  thread_id bigint references public.threads(id) on delete set null,
  published_at timestamptz,
  error_message text,
  admin_note text,
  hold_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint x_buzz_queue_source_url_key unique (source_url),
  constraint x_buzz_queue_status_check check (
    status in ('pending', 'processing', 'published', 'failed', 'hold', 'rejected')
  ),
  constraint x_buzz_queue_source_url_check check (
    source_url ~ '^https://x\.com/[A-Za-z0-9_]{1,15}/status/[0-9]{5,25}$'
  )
);

create index if not exists idx_x_buzz_queue_status_created
  on public.x_buzz_queue (status, created_at asc);

create index if not exists idx_x_buzz_queue_thread_id
  on public.x_buzz_queue (thread_id)
  where thread_id is not null;

create index if not exists idx_x_buzz_queue_published_at
  on public.x_buzz_queue (published_at desc)
  where published_at is not null;

create or replace function public.set_x_buzz_queue_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_x_buzz_queue_updated_at on public.x_buzz_queue;
create trigger trg_x_buzz_queue_updated_at
  before update on public.x_buzz_queue
  for each row execute function public.set_x_buzz_queue_updated_at();

alter table public.x_buzz_queue enable row level security;

comment on table public.x_buzz_queue is
  'X話題URLストック。service_role専用でURLキューとスレ化結果を管理する';
comment on column public.x_buzz_queue.source_url is
  '正規化済みX status URL。本文末尾にもこのURLだけをラベルなしで使う';
comment on column public.x_buzz_queue.status is
  'pending / processing / published / failed / hold / rejected';
comment on column public.x_buzz_queue.error_message is
  '公開失敗時の短いエラー。失敗時Discord通知は送らない';
