-- X自動運用システム: 投稿管理テーブル群
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行

-- ============================================================
-- 1. x_posts（投稿本体）
-- ============================================================
create table if not exists x_posts (
  id            bigint generated always as identity primary key,
  post_type     text not null check (post_type in ('tournament_result','quiz_silhouette','quiz_odd','announcement','custom')),
  status        text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  title         text,
  thread_lines  text[] not null default '{}',
  image_urls    text[] default '{}',
  typefully_id  text,
  typefully_share_url text,
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  source_ref    text,
  meta          jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 自動更新トリガー
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists x_posts_updated_at on x_posts;
create trigger x_posts_updated_at
  before update on x_posts
  for each row execute function update_updated_at_column();

-- RLS: service role のみ（anon / authenticated はアクセス不可）
alter table x_posts enable row level security;

-- 既存ポリシーがある場合は削除してから再作成
drop policy if exists "deny all anon" on x_posts;
create policy "deny all anon" on x_posts
  using (false);

-- ============================================================
-- 2. x_post_images（生成画像メタ管理）
-- ============================================================
create table if not exists x_post_images (
  id           bigint generated always as identity primary key,
  x_post_id    bigint references x_posts(id) on delete cascade,
  image_type   text not null check (image_type in ('winner_card','silhouette','odd_one_out','upload')),
  storage_path text not null,
  public_url   text not null,
  gen_params   jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

alter table x_post_images enable row level security;
drop policy if exists "deny all anon" on x_post_images;
create policy "deny all anon" on x_post_images
  using (false);

-- ============================================================
-- 3. x_reply_logs（Apifyリプライ収集 / Phase 3用）
-- ============================================================
create table if not exists x_reply_logs (
  id           bigint generated always as identity primary key,
  x_post_id    bigint references x_posts(id) on delete set null,
  tweet_id     text not null unique,
  author_name  text,
  content      text,
  replied_at   timestamptz,
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table x_reply_logs enable row level security;
drop policy if exists "deny all anon" on x_reply_logs;
create policy "deny all anon" on x_reply_logs
  using (false);
