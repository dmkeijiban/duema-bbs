-- メーカー機能向け共通カードマスター
-- DRAFT: Preview で検証後、承認されるまで本番DBへ適用しない。
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  image_url text,
  civilization text[] not null default '{}',
  cost integer check (cost is null or cost >= 0),
  card_type text,
  regulation text not null default 'none',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cards is 'メーカー機能共通の代表カード。収録版・別イラストは将来の子テーブルで管理する';
create index if not exists cards_active_name_idx on public.cards (is_active, normalized_name);

alter table public.cards enable row level security;
-- anon/authenticated には公開しない。service role のみバイパスする。

-- 図鑑からの紐付けは全カード化と切り離し、任意で段階的に行える。
do $$ begin
  if to_regclass('public.zukan_cards') is not null then
    alter table public.zukan_cards add column if not exists card_id uuid references public.cards(id) on delete set null;
    create index if not exists zukan_cards_card_id_idx on public.zukan_cards(card_id);
  end if;
end $$;
