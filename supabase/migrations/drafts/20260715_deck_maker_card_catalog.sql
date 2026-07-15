-- DRAFT ONLY: 承認されるまで本番適用しない。既存 cards を壊さない additive migration。
alter table if exists public.cards add column if not exists name_kana text;
alter table if exists public.cards add column if not exists is_catalog_complete boolean not null default false;
alter table if exists public.cards add column if not exists catalog_review_status text not null default 'needs_review'
  check (catalog_review_status in ('needs_review', 'complete', 'blocked'));

create table if not exists public.card_printings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  source_key text not null unique,
  official_page_url text,
  image_url text,
  set_name text,
  card_number text,
  is_representative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists card_printings_card_id_idx on public.card_printings(card_id);
create index if not exists cards_name_kana_idx on public.cards(name_kana);
alter table public.card_printings enable row level security;
comment on table public.card_printings is '収録版別の公式ページURL・画像URL。画像本体は保存しない';
