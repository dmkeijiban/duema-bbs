-- 思い出図鑑 0時投稿の実行履歴・使用済みカード管理。
-- service_role 専用で読み書きし、公開ユーザーには露出しない。

create table if not exists public.zukan_daily_card_posts (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  card_id uuid not null references public.zukan_cards(id) on update cascade,
  card_slug text,
  card_name text not null,
  card_image_url text not null,
  thread_id bigint references public.threads(id) on delete set null,
  thread_created_at timestamptz,
  thread_url text,
  typefully_post_id text,
  typefully_created_at timestamptz,
  typefully_url text,
  typefully_image_attached boolean not null default false,
  image_checked_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'thread_created', 'typefully_created', 'posted', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zukan_daily_card_posts_run_date_unique unique (run_date),
  constraint zukan_daily_card_posts_card_id_unique unique (card_id)
);

create index if not exists idx_zukan_daily_card_posts_status_created
  on public.zukan_daily_card_posts (status, created_at desc);

create index if not exists idx_zukan_daily_card_posts_card_slug
  on public.zukan_daily_card_posts (card_slug)
  where card_slug is not null;

alter table public.zukan_daily_card_posts enable row level security;

comment on table public.zukan_daily_card_posts is
  '思い出図鑑0時投稿の使用済みカード・スレ・Typefully作成状態を管理する内部テーブル';
comment on column public.zukan_daily_card_posts.run_date is
  'JST基準の実行日。unique(run_date)で同日二重投稿を防止する';
comment on column public.zukan_daily_card_posts.card_id is
  '対象 zukan_cards.id。unique(card_id)で同じカードの再利用を防止する';
comment on column public.zukan_daily_card_posts.status is
  'pending / thread_created / typefully_created / posted / failed';
comment on column public.zukan_daily_card_posts.typefully_image_attached is
  'Typefully作成時にカード画像URLをメディア添付として渡せた場合にtrue';
