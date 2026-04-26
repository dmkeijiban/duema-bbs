-- Web Push 購読情報テーブル
create table if not exists push_subscriptions (
  id          bigserial primary key,
  thread_id   bigint not null references threads(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (thread_id, endpoint)
);

-- RLS有効化
alter table push_subscriptions enable row level security;

-- INSERT: 誰でも購読できる（anon key）
create policy "anon can insert push_subscriptions"
  on push_subscriptions for insert
  to anon
  with check (true);

-- DELETE: 自分のエンドポイントは削除できる
create policy "anon can delete own push_subscriptions"
  on push_subscriptions for delete
  to anon
  using (true);

-- SELECT は service_role のみ（ポリシーなし = anon/authenticated からは取得不可）
