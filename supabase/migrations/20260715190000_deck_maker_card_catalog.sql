-- Additive catalog extension for the deck maker. Image binaries are never stored.
create extension if not exists pg_trgm;

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
create unique index if not exists card_printings_one_representative_idx on public.card_printings(card_id) where is_representative;
create index if not exists cards_normalized_name_trgm_idx on public.cards using gin(normalized_name gin_trgm_ops);
create index if not exists cards_name_kana_trgm_idx on public.cards using gin(name_kana gin_trgm_ops);

alter table public.card_printings enable row level security;
comment on table public.card_printings is '収録版別の公式ページURL・画像URL。画像本体は保存しない';
