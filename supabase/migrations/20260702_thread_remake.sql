-- スレアレンジ: 自サイト内の既存人気スレを元にしたリメイク識別カラム。
-- 実行前に本番DBバックアップを取得すること。

alter table public.threads
  add column if not exists remade_from_thread_id bigint references public.threads(id) on delete set null,
  add column if not exists remake_type text;

create index if not exists idx_threads_remade_from_thread_id
  on public.threads(remade_from_thread_id)
  where remade_from_thread_id is not null;

create index if not exists idx_threads_remake_type
  on public.threads(remake_type)
  where remake_type is not null;

create unique index if not exists idx_threads_unique_popular_thread_remake_source
  on public.threads(remade_from_thread_id)
  where remake_type = 'popular_thread_remake'
    and remade_from_thread_id is not null;

comment on column public.threads.remade_from_thread_id is
  'スレアレンジなどでリメイク元になった自サイト内スレID。';

comment on column public.threads.remake_type is
  'リメイク種別。スレアレンジは popular_thread_remake。';
