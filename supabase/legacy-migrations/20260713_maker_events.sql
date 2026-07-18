-- maker_events: Tier表など各メーカー企画の利用イベント計測。
-- 依存: maker_projects（drafts/20260712_maker_tier.sql の共通メーカー基盤）を先に適用しておくこと。
-- 個人特定情報（IPアドレス等）やカード配置内容は保存しない。

create table if not exists public.maker_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.maker_projects(id) on delete cascade,
  event_type text not null check (event_type in ('tier_created', 'image_saved', 'x_shared', 'aggregate_viewed')),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text check (anonymous_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  created_at timestamptz not null default now(),
  constraint maker_events_actor_present check (user_id is not null or anonymous_id is not null)
);

create index if not exists maker_events_project_type_created_idx
  on public.maker_events (project_id, event_type, created_at desc);
create index if not exists maker_events_actor_recent_idx
  on public.maker_events (project_id, event_type, coalesce(user_id::text, anonymous_id), created_at desc);

-- RLS: policyを一切作らない = anon/authenticated は読み書き不可。service_role のみ操作可。
alter table public.maker_events enable row level security;
revoke all on public.maker_events from anon, authenticated;

comment on table public.maker_events is 'メーカー企画の利用イベント（tier_created / image_saved / x_shared / aggregate_viewed）。計測開始以前の回数は復元不可。';

-- 短時間の重複（連打・二重送信）を除外して記録する。
-- 同一企画・同一イベント・同一アクター（user_id または anonymous_id）で
-- p_dedup_seconds 以内に既存レコードがあれば挿入せず false を返す。
-- 日をまたいだ再利用は dedup 窓の外なので通常どおり記録される。
create or replace function public.record_maker_event(
  p_project_id uuid,
  p_event_type text,
  p_user_id uuid,
  p_anonymous_id text,
  p_dedup_seconds integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
begin
  v_actor := coalesce(p_user_id::text, p_anonymous_id);
  if v_actor is null then
    raise exception 'MAKER_EVENT_ACTOR_REQUIRED';
  end if;

  if exists (
    select 1
    from maker_events
    where project_id = p_project_id
      and event_type = p_event_type
      and coalesce(user_id::text, anonymous_id) = v_actor
      and created_at > now() - make_interval(secs => greatest(coalesce(p_dedup_seconds, 0), 0))
  ) then
    return false;
  end if;

  insert into maker_events (project_id, event_type, user_id, anonymous_id)
  values (p_project_id, p_event_type, p_user_id, p_anonymous_id);
  return true;
end $$;

revoke all on function public.record_maker_event(uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_maker_event(uuid, text, uuid, text, integer) to service_role;

-- 管理画面の利用状況表示用の集計。p_today_start は JST 0:00 を UTC に変換した値を渡す。
create or replace function public.maker_event_stats(
  p_project_id uuid,
  p_today_start timestamptz
) returns table (
  event_type text,
  total_count bigint,
  today_count bigint,
  unique_actors bigint
)
language sql security definer set search_path = public as $$
  select
    e.event_type,
    count(*)::bigint as total_count,
    count(*) filter (where e.created_at >= p_today_start)::bigint as today_count,
    count(distinct coalesce(e.user_id::text, e.anonymous_id))::bigint as unique_actors
  from maker_events e
  where e.project_id = p_project_id
  group by e.event_type
$$;

revoke all on function public.maker_event_stats(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.maker_event_stats(uuid, timestamptz) to service_role;
