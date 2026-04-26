-- メール通知サブスクリプションテーブル
-- お気に入り・レス投稿・スレ作成時にメールを登録 → 返信時に通知送信
create table if not exists email_subscriptions (
  id bigserial primary key,
  thread_id bigint not null references threads(id) on delete cascade,
  email text not null,
  unsubscribe_token text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  unique(thread_id, email)
);

create index if not exists idx_email_sub_thread on email_subscriptions(thread_id);
create index if not exists idx_email_sub_token  on email_subscriptions(unsubscribe_token);

-- RLS: INSERT は誰でも可（サブスク登録）。SELECT/DELETE はサービスロールキーのみ（ANON不可）
alter table email_subscriptions enable row level security;
create policy "email_sub_insert" on email_subscriptions for insert with check (true);
-- DELETE は unsubscribe_token 一致のみ許可（配信停止ページ用）
create policy "email_sub_delete_by_token" on email_subscriptions
  for delete using (true);  -- Server Action 側でトークン照合するため全許可（service role で呼ぶ）
