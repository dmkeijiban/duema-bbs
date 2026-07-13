-- Tierメーカー本体のページ表示を、再読み込みを含む1表示=1PVで記録する。
-- 既存イベントから過去PVは補完せず、このmigration適用後から計測する。

alter table public.maker_events drop constraint if exists maker_events_event_type_check;
alter table public.maker_events add constraint maker_events_event_type_check check (
  event_type in ('tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup')
);

alter table public.maker_events add column if not exists view_id uuid;
create unique index if not exists maker_events_page_view_id_uidx
  on public.maker_events (view_id) where event_type = 'page_viewed';

create or replace function public.record_maker_page_view(
  p_project_id uuid,
  p_user_id uuid,
  p_anonymous_id text,
  p_view_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null and p_anonymous_id is null then raise exception 'MAKER_EVENT_ACTOR_REQUIRED'; end if;
  insert into public.maker_events (project_id,event_type,user_id,anonymous_id,view_id)
  values (p_project_id,'page_viewed',p_user_id,p_anonymous_id,p_view_id)
  on conflict (view_id) where event_type = 'page_viewed' do nothing;
  return found;
end $$;

revoke all on function public.record_maker_page_view(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.record_maker_page_view(uuid,uuid,text,uuid) to service_role;

comment on column public.maker_events.view_id is 'ページ表示ごとの冪等キー。個人識別には使用しない。';
comment on table public.maker_events is 'メーカー企画の利用イベント。IP・フィンガープリントは保存せず、PVは計測migration適用後のみ。';
