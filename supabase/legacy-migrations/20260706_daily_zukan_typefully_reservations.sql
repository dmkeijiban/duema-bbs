-- 思い出図鑑0時ポストの事前Typefully予約状態。
-- 未来カード予定は daily_zukan_thread_schedule を正とし、同じ行に予約結果を保持する。

alter table public.daily_zukan_thread_schedule
  add column if not exists typefully_status text
    check (typefully_status in ('processing', 'scheduled', 'error')),
  add column if not exists typefully_id text,
  add column if not exists typefully_url text,
  add column if not exists typefully_scheduled_at timestamptz,
  add column if not exists typefully_reserved_at timestamptz,
  add column if not exists typefully_media_id text,
  add column if not exists typefully_image_url text,
  add column if not exists typefully_image_source text,
  add column if not exists typefully_error text;

create index if not exists idx_daily_zukan_schedule_typefully_status
  on public.daily_zukan_thread_schedule (typefully_status, scheduled_date);

create unique index if not exists idx_daily_zukan_schedule_typefully_id_unique
  on public.daily_zukan_thread_schedule (typefully_id)
  where typefully_id is not null;

comment on column public.daily_zukan_thread_schedule.typefully_status is
  '思い出図鑑0時ポストのTypefully事前予約状態: processing / scheduled / error';
comment on column public.daily_zukan_thread_schedule.typefully_id is
  'Typefully draft ID。値がある場合は同日分を再予約しない';
comment on column public.daily_zukan_thread_schedule.typefully_scheduled_at is
  'Typefullyで予約した投稿予定時刻。JST 0:00 は UTC 15:00';
comment on column public.daily_zukan_thread_schedule.typefully_image_source is
  'card_image / card_page_og_fallback / default_og_fallback';
