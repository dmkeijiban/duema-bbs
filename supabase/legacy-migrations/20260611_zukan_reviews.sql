-- 図鑑レビュー・評価テーブル群
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行

-- ============================================================
-- 1. zukan_pack_reviews（パックの思い出投稿）
-- ============================================================
create table if not exists zukan_pack_reviews (
  id            bigint generated always as identity primary key,
  pack_id       uuid not null references zukan_packs(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null default '名無しさん',
  body          text not null,
  is_deleted    boolean not null default false,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists zukan_pack_reviews_pack_id_idx on zukan_pack_reviews(pack_id);
create index if not exists zukan_pack_reviews_created_at_idx on zukan_pack_reviews(created_at desc);

alter table zukan_pack_reviews enable row level security;

-- 読み取り: 非削除・非非表示は誰でも可
drop policy if exists "pack_reviews select" on zukan_pack_reviews;
create policy "pack_reviews select" on zukan_pack_reviews
  for select using (is_deleted = false and is_hidden = false);

-- 書き込み: 誰でも投稿可（anon含む）
drop policy if exists "pack_reviews insert" on zukan_pack_reviews;
create policy "pack_reviews insert" on zukan_pack_reviews
  for insert with check (true);

-- ============================================================
-- 2. zukan_card_reviews（カードの思い出レビュー）
-- ============================================================
create table if not exists zukan_card_reviews (
  id            bigint generated always as identity primary key,
  card_id       uuid not null references zukan_cards(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null default '名無しさん',
  body          text not null,
  is_deleted    boolean not null default false,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists zukan_card_reviews_card_id_idx on zukan_card_reviews(card_id);
create index if not exists zukan_card_reviews_created_at_idx on zukan_card_reviews(created_at desc);

alter table zukan_card_reviews enable row level security;

drop policy if exists "card_reviews select" on zukan_card_reviews;
create policy "card_reviews select" on zukan_card_reviews
  for select using (is_deleted = false and is_hidden = false);

drop policy if exists "card_reviews insert" on zukan_card_reviews;
create policy "card_reviews insert" on zukan_card_reviews
  for insert with check (true);

-- ============================================================
-- 3. zukan_card_ratings（カードの5項目評価）
-- ============================================================
create table if not exists zukan_card_ratings (
  id                bigint generated always as identity primary key,
  card_id           uuid not null references zukan_cards(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  -- 未ログインユーザーの重複投票抑制（cookieで渡すfingerprintをハッシュ化して保存）
  anon_key          text,
  -- 5項目評価（1〜5）
  score_admiration  smallint check (score_admiration between 1 and 5),   -- 当時の憧れ度
  score_trauma      smallint check (score_trauma between 1 and 5),        -- 使われた時のトラウマ度
  score_still_like  smallint check (score_still_like between 1 and 5),    -- 今見ても好き度
  score_name        smallint check (score_name between 1 and 5),          -- 名前のかっこよさ
  score_art         smallint check (score_art between 1 and 5),           -- イラストのかっこよさ
  is_deleted        boolean not null default false,
  created_at        timestamptz not null default now(),
  -- ログインユーザーは1カードにつき1件
  constraint zukan_card_ratings_user_unique unique nulls not distinct (card_id, user_id)
);

create index if not exists zukan_card_ratings_card_id_idx on zukan_card_ratings(card_id);

alter table zukan_card_ratings enable row level security;

drop policy if exists "card_ratings select" on zukan_card_ratings;
create policy "card_ratings select" on zukan_card_ratings
  for select using (is_deleted = false);

drop policy if exists "card_ratings insert" on zukan_card_ratings;
create policy "card_ratings insert" on zukan_card_ratings
  for insert with check (true);
