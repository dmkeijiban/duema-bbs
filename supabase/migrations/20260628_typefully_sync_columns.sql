-- Typefully予約投稿 -> 掲示板スレ化の同期状態カラム追加
--
-- 事前確認SQL（typefully_id の重複がある場合、下の unique index 作成で失敗する）:
--
-- select typefully_id, count(*) as count
-- from x_posts
-- where typefully_id is not null
-- group by typefully_id
-- having count(*) > 1;
--
-- ロールバック例:
--
-- drop index if exists idx_x_posts_typefully_id_unique;
-- alter table x_posts
--   drop column if exists source_status,
--   drop column if exists retry_count,
--   drop column if exists last_attempt_at,
--   drop column if exists sync_error,
--   drop column if exists synced_at,
--   drop column if exists thread_id;

alter table x_posts
  add column if not exists thread_id bigint references threads(id) on delete set null,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_error text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists source_status text;

create unique index if not exists idx_x_posts_typefully_id_unique
  on x_posts(typefully_id)
  where typefully_id is not null;

comment on column x_posts.thread_id is
  'Typefully予約投稿から作成された掲示板スレッドID。スレ化前はnull。';

comment on column x_posts.synced_at is
  '掲示板スレ化が成功した日時。';

comment on column x_posts.sync_error is
  '直近の掲示板スレ化失敗理由。成功時はnullにする想定。';

comment on column x_posts.last_attempt_at is
  '掲示板スレ化を最後に試行した日時。';

comment on column x_posts.retry_count is
  '掲示板スレ化の失敗・再試行回数。';

comment on column x_posts.source_status is
  'Typefully側のdraft状態（scheduled/published/error等）。x_posts.statusは掲示板側の運用状態として扱う。';
