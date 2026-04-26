-- 週次・月次まとめテーブル
create table if not exists summaries (
  id           bigserial primary key,
  type         text not null check (type in ('weekly', 'monthly')),
  slug         text not null unique,          -- e.g. "weekly-2026-04-14" / "monthly-2026-04"
  title        text not null,                  -- e.g. "先週の人気スレッドTOP5（4/14〜4/20）"
  period_start date not null,
  period_end   date not null,
  threads      jsonb not null default '[]',   -- [{id,title,post_count,activity,image_url,category_name,category_color,rank}]
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table summaries enable row level security;

-- 公開まとめは誰でも読める
create policy "public read summaries"
  on summaries for select to anon using (published = true);

-- API route (CRON_SECRET で保護) からの INSERT を許可
create policy "anon insert summaries"
  on summaries for insert to anon with check (true);
