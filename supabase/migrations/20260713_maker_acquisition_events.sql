-- Tier表の流入→登録→初回回答ファネルを既存 maker_events へ追加する。
-- 既存行は変更・削除せず、RLS/service_role専用設計を維持する。

create unique index if not exists maker_events_signup_completed_user_uidx
  on public.maker_events (user_id)
  where event_type = 'signup_completed' and user_id is not null;

create unique index if not exists maker_events_submission_after_signup_uidx
  on public.maker_events (project_id, user_id)
  where event_type = 'submission_after_signup' and user_id is not null;

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
  if p_event_type not in ('tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup') then
    raise exception 'INVALID_MAKER_EVENT_TYPE';
  end if;
  v_actor := coalesce(p_user_id::text, p_anonymous_id);
  if v_actor is null then raise exception 'MAKER_EVENT_ACTOR_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_event_type || ':' || v_actor, 0));
  if exists (
    select 1 from public.maker_events
    where project_id = p_project_id and event_type = p_event_type
      and coalesce(user_id::text, anonymous_id) = v_actor
      and created_at > now() - make_interval(secs => greatest(coalesce(p_dedup_seconds, 0), 0))
  ) then return false; end if;

  insert into public.maker_events (project_id,event_type,user_id,anonymous_id)
  values (p_project_id,p_event_type,p_user_id,p_anonymous_id)
  on conflict do nothing;
  return found;
end $$;

revoke all on function public.record_maker_event(uuid,text,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.record_maker_event(uuid,text,uuid,text,integer) to service_role;

create or replace function public.maker_event_stats(p_project_id uuid, p_today_start timestamptz)
returns table (event_type text,total_count bigint,today_count bigint,unique_actors bigint,today_unique_actors bigint)
language sql security definer set search_path = public as $$
  select e.event_type, count(*)::bigint,
    count(*) filter (where e.created_at >= p_today_start)::bigint,
    count(distinct coalesce(e.user_id::text,e.anonymous_id))::bigint,
    count(distinct coalesce(e.user_id::text,e.anonymous_id)) filter (where e.created_at >= p_today_start)::bigint
  from public.maker_events e where e.project_id = p_project_id group by e.event_type
$$;

revoke all on function public.maker_event_stats(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.maker_event_stats(uuid,timestamptz) to service_role;

comment on table public.maker_events is 'メーカー企画の利用イベント。IP・フィンガープリントは保存しない。';
