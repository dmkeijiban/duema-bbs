-- session_idカラムを追加（所有者確認用）
alter table threads add column if not exists session_id text;
alter table posts add column if not exists session_id text;

-- お問い合わせテーブル
create table if not exists contact_messages (
  id bigserial primary key,
  subject text not null,
  email text,
  body text not null,
  created_at timestamptz not null default now()
);

-- DANGER: production posts/threads must not be physically deleted.
-- This historical policy enabled DELETE during early development; do not run it on production again.
-- Use posts.is_deleted=true for post removal and threads.is_archived=true for thread hiding.
-- RLS: 削除は誰でも（server-side session check）
create policy "threads_delete" on threads for delete using (true);
create policy "posts_delete" on posts for delete using (true);

-- インデックス
create index if not exists idx_threads_session on threads(session_id);
create index if not exists idx_posts_session on posts(session_id);

-- contact_messages RLS
alter table contact_messages enable row level security;
create policy "contact_insert" on contact_messages for insert with check (true);
