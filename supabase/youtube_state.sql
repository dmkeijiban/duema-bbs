-- YouTube通知の重複防止用状態テーブル
create table if not exists youtube_state (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table youtube_state enable row level security;

-- 通知状態はサーバー側 service_role からのみ読み書きする。
