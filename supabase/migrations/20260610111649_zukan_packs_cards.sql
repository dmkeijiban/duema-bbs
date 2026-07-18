-- ============================================================
-- 図鑑: パックテーブル / カードテーブル
-- ============================================================

-- パック
create table if not exists public.zukan_packs (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  code          text not null,
  name          text not null,
  released_year text,
  card_count    int,
  description   text,
  is_published  boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- カード
create table if not exists public.zukan_cards (
  id            uuid primary key default gen_random_uuid(),
  pack_id       uuid not null references public.zukan_packs(id) on delete cascade,
  slug          text not null unique,
  name          text not null,
  card_type     text,
  civilization  text,
  cost          int,
  mana          int,
  race          text,
  power         text,
  rarity        text,
  illustrator   text,
  ability_text  text,
  flavor_text   text,
  image_url     text,
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- インデックス
create index if not exists zukan_cards_pack_id_sort on public.zukan_cards(pack_id, sort_order);
create index if not exists zukan_cards_slug on public.zukan_cards(slug);

-- RLS: 公開読み取りのみ
alter table public.zukan_packs enable row level security;
alter table public.zukan_cards enable row level security;

create policy "公開パック読み取り" on public.zukan_packs
  for select using (is_published = true);

create policy "公開カード読み取り" on public.zukan_cards
  for select using (
    is_published = true
    and exists (
      select 1 from public.zukan_packs p
      where p.id = pack_id and p.is_published = true
    )
  );;
