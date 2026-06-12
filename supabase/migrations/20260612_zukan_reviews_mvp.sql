-- Zukan reviews MVP: non-destructive extensions for pack/card memories and ratings.
-- No destructive operations. No Storage or image data is touched.

create table if not exists public.zukan_pack_reviews (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.zukan_packs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  author_name text default '匿名',
  body text,
  is_hidden boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zukan_card_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.zukan_cards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  author_name text default '匿名',
  body text,
  is_hidden boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zukan_card_ratings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.zukan_cards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  author_name text default '匿名',
  nostalgia_score smallint,
  play_score smallint,
  now_score smallint,
  name_score smallint,
  illustration_score smallint,
  is_hidden boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zukan_pack_reviews add column if not exists pack_id uuid references public.zukan_packs(id) on delete cascade;
alter table public.zukan_pack_reviews add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.zukan_pack_reviews add column if not exists anonymous_session_id text;
alter table public.zukan_pack_reviews add column if not exists author_name text default '匿名';
alter table public.zukan_pack_reviews add column if not exists body text;
alter table public.zukan_pack_reviews add column if not exists is_hidden boolean not null default false;
alter table public.zukan_pack_reviews add column if not exists is_deleted boolean not null default false;
alter table public.zukan_pack_reviews add column if not exists created_at timestamptz not null default now();
alter table public.zukan_pack_reviews add column if not exists updated_at timestamptz not null default now();

alter table public.zukan_card_reviews add column if not exists card_id uuid references public.zukan_cards(id) on delete cascade;
alter table public.zukan_card_reviews add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.zukan_card_reviews add column if not exists anonymous_session_id text;
alter table public.zukan_card_reviews add column if not exists author_name text default '匿名';
alter table public.zukan_card_reviews add column if not exists body text;
alter table public.zukan_card_reviews add column if not exists is_hidden boolean not null default false;
alter table public.zukan_card_reviews add column if not exists is_deleted boolean not null default false;
alter table public.zukan_card_reviews add column if not exists created_at timestamptz not null default now();
alter table public.zukan_card_reviews add column if not exists updated_at timestamptz not null default now();

alter table public.zukan_card_ratings add column if not exists card_id uuid references public.zukan_cards(id) on delete cascade;
alter table public.zukan_card_ratings add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.zukan_card_ratings add column if not exists anonymous_session_id text;
alter table public.zukan_card_ratings add column if not exists author_name text default '匿名';
alter table public.zukan_card_ratings add column if not exists nostalgia_score smallint;
alter table public.zukan_card_ratings add column if not exists play_score smallint;
alter table public.zukan_card_ratings add column if not exists now_score smallint;
alter table public.zukan_card_ratings add column if not exists name_score smallint;
alter table public.zukan_card_ratings add column if not exists illustration_score smallint;
alter table public.zukan_card_ratings add column if not exists is_hidden boolean not null default false;
alter table public.zukan_card_ratings add column if not exists is_deleted boolean not null default false;
alter table public.zukan_card_ratings add column if not exists created_at timestamptz not null default now();
alter table public.zukan_card_ratings add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_zukan_pack_reviews_visible_created
  on public.zukan_pack_reviews(pack_id, created_at desc)
  where is_hidden = false and is_deleted = false;

create index if not exists idx_zukan_card_reviews_visible_created
  on public.zukan_card_reviews(card_id, created_at desc)
  where is_hidden = false and is_deleted = false;

create index if not exists idx_zukan_card_ratings_visible_card
  on public.zukan_card_ratings(card_id, updated_at desc)
  where is_hidden = false and is_deleted = false;

create index if not exists idx_zukan_pack_reviews_session_recent
  on public.zukan_pack_reviews(anonymous_session_id, created_at desc);

create index if not exists idx_zukan_card_reviews_session_recent
  on public.zukan_card_reviews(anonymous_session_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'zukan_card_ratings_card_user_unique'
  ) then
    begin
      create unique index zukan_card_ratings_card_user_unique
        on public.zukan_card_ratings(card_id, user_id)
        where user_id is not null and is_deleted = false;
    exception when unique_violation then
      raise notice 'Skipped zukan_card_ratings_card_user_unique because duplicate rows already exist.';
    end;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'zukan_card_ratings_card_session_unique'
  ) then
    begin
      create unique index zukan_card_ratings_card_session_unique
        on public.zukan_card_ratings(card_id, anonymous_session_id)
        where user_id is null and anonymous_session_id is not null and is_deleted = false;
    exception when unique_violation then
      raise notice 'Skipped zukan_card_ratings_card_session_unique because duplicate rows already exist.';
    end;
  end if;
end $$;

alter table public.zukan_pack_reviews enable row level security;
alter table public.zukan_card_reviews enable row level security;
alter table public.zukan_card_ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'zukan_pack_reviews'
      and policyname = 'zukan_pack_reviews_public_select_visible'
  ) then
    create policy zukan_pack_reviews_public_select_visible
      on public.zukan_pack_reviews
      for select
      using (is_hidden = false and is_deleted = false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'zukan_card_reviews'
      and policyname = 'zukan_card_reviews_public_select_visible'
  ) then
    create policy zukan_card_reviews_public_select_visible
      on public.zukan_card_reviews
      for select
      using (is_hidden = false and is_deleted = false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'zukan_card_ratings'
      and policyname = 'zukan_card_ratings_public_select_visible'
  ) then
    create policy zukan_card_ratings_public_select_visible
      on public.zukan_card_ratings
      for select
      using (is_hidden = false and is_deleted = false);
  end if;
end $$;

grant select on public.zukan_pack_reviews to anon, authenticated;
grant select on public.zukan_card_reviews to anon, authenticated;
grant select on public.zukan_card_ratings to anon, authenticated;
