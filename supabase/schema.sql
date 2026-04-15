-- カテゴリテーブル
create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  description text,
  color text not null default '#3b82f6',
  sort_order int not null default 0
);

-- スレッドテーブル
create table if not exists threads (
  id bigserial primary key,
  title text not null,
  body text not null,
  category_id int references categories(id) on delete set null,
  author_name text not null default '名無しのデュエリスト',
  image_url text,
  view_count int not null default 0,
  post_count int not null default 1,
  is_archived bool not null default false,
  created_at timestamptz not null default now(),
  last_posted_at timestamptz not null default now()
);

-- レステーブル
create table if not exists posts (
  id bigserial primary key,
  thread_id bigint not null references threads(id) on delete cascade,
  post_number int not null,
  body text not null,
  author_name text not null default '名無しのデュエリスト',
  image_url text,
  created_at timestamptz not null default now()
);

-- お気に入りテーブル（cookieベースの識別子）
create table if not exists favorites (
  id bigserial primary key,
  session_id text not null,
  thread_id bigint not null references threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(session_id, thread_id)
);

-- インデックス
create index if not exists idx_threads_category on threads(category_id);
create index if not exists idx_threads_last_posted on threads(last_posted_at desc);
create index if not exists idx_posts_thread on posts(thread_id, post_number);
create index if not exists idx_favorites_session on favorites(session_id);

-- カテゴリ初期データ
insert into categories (name, slug, description, color, sort_order) values
  ('新カード・カード評価', 'card',     '新弾・既存カードの評価・考察', '#e83e8c', 0),
  ('デッキ関連',         'deck',     'デッキレシピ・構築相談',     '#007bff', 1),
  ('CS大会・環境関係',   'cs',       '大会結果・環境考察',         '#fd7e14', 2),
  ('高騰・下落情報',     'price',    'カード相場・高騰・下落',     '#20c997', 3),
  ('デュエプレ',         'dueplace', 'デュエルマスターズプレイス', '#6f42c1', 4),
  ('アニメ・漫画',       'anime',    'アニメ・漫画の話題',         '#dc3545', 5),
  ('デュエパ等の特殊ルール', 'duepa', 'デュエパーティー等',        '#17a2b8', 6),
  ('デュエマクラシック', 'classic',  'クラシックフォーマット',     '#795548', 7),
  ('雑談',               'casual',   'ゲーム外の雑談',             '#6c757d', 8)
on conflict (slug) do nothing;

-- スレッドのpost_countとlast_posted_atを自動更新するトリガー
create or replace function update_thread_on_post()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update threads
    set post_count = post_count + 1,
        last_posted_at = now()
    where id = NEW.thread_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_thread_on_post on posts;
create trigger trg_update_thread_on_post
  after insert on posts
  for each row execute function update_thread_on_post();

-- ビュー数インクリメント用RPC
create or replace function increment_view_count(thread_id bigint)
returns void as $$
  update threads set view_count = view_count + 1 where id = thread_id;
$$ language sql;

-- RLS: 全テーブルを一般公開読み取り可能に
alter table categories enable row level security;
alter table threads enable row level security;
alter table posts enable row level security;
alter table favorites enable row level security;

create policy "categories_select" on categories for select using (true);
create policy "threads_select" on threads for select using (true);
create policy "threads_insert" on threads for insert with check (true);
create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (true);
create policy "favorites_select" on favorites for select using (true);
create policy "favorites_insert" on favorites for insert with check (true);
create policy "favorites_delete" on favorites for delete using (true);

-- Storageバケット（Supabaseダッシュボードで作成が必要）
-- バケット名: bbs-images (public)
