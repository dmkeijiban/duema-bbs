begin;

alter table public.maker_projects drop constraint if exists maker_projects_type_check;
alter table public.maker_projects add constraint maker_projects_type_check check(type=any(array['tier','prediction','selection','select']));

alter table public.maker_submissions add column if not exists creation_session_id uuid;
alter table public.maker_submission_items add column if not exists selection_order integer;
create unique index if not exists maker_submissions_select_session_user_uidx on public.maker_submissions(project_id,user_id,creation_session_id) where creation_session_id is not null and user_id is not null;
create unique index if not exists maker_submissions_select_session_anon_uidx on public.maker_submissions(project_id,anonymous_actor_hash,creation_session_id) where creation_session_id is not null and anonymous_actor_hash is not null;
create index if not exists maker_submission_items_select_aggregate_idx on public.maker_submission_items(card_id,position,selection_order,submission_id) where group_key='selected';

alter table public.maker_events drop constraint if exists maker_events_event_type_check;
alter table public.maker_events add constraint maker_events_event_type_check check(event_type=any(array[
  'tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup',
  'creation_started','card_searched','card_added','card_removed','card_reordered','selection_completed','image_save_started','submission_registered','submission_updated','submission_deleted','submissions_viewed','draft_restored','new_draft_started','listing_enabled','listing_disabled'
]));

create or replace function public.upsert_select_maker_submission(
  p_project_id uuid,p_user_id uuid,p_edit_token_hash text,p_actor_hash text,p_session_id uuid,p_submission_id uuid,p_title text,p_comment text,p_card_ids uuid[]
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_config jsonb; v_min int; v_max int; v_exact bool; v_pool text; v_duplicate text;
begin
  select config into v_config from maker_projects where id=p_project_id and type='select' and status='published' and is_public for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_PUBLISHED'; end if;
  v_min:=coalesce((v_config->>'minChoices')::int,1); v_max:=coalesce((v_config->>'maxChoices')::int,12);
  v_exact:=coalesce((v_config->>'exactChoices')::bool,true); v_pool:=coalesce(v_config->>'cardPool','all'); v_duplicate:=coalesce(v_config->>'duplicateRule','card_name');
  if p_card_ids is null or cardinality(p_card_ids)<v_min or cardinality(p_card_ids)>v_max or (v_exact and cardinality(p_card_ids)<>v_max) then raise exception 'MAKER_CHOICE_COUNT_INVALID'; end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 or (p_comment is not null and char_length(btrim(p_comment))>200) then raise exception 'MAKER_META_INVALID'; end if;
  if (p_user_id is null)=(p_edit_token_hash is null) then raise exception 'MAKER_OWNER_INVALID'; end if;
  if p_user_id is null and (p_edit_token_hash !~ '^[0-9a-f]{64}$' or p_actor_hash !~ '^[0-9a-f]{64}$') then raise exception 'MAKER_OWNER_INVALID'; end if;
  if exists(select 1 from unnest(p_card_ids) x(id) left join cards c on c.id=x.id and c.is_active where c.id is null) then raise exception 'MAKER_CARD_INVALID'; end if;
  if v_pool='manual' and exists(select 1 from unnest(p_card_ids) x(id) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.id where pc.card_id is null) then raise exception 'MAKER_CARD_OUTSIDE_POOL'; end if;
  if v_duplicate='card_id' and (select count(*) from unnest(p_card_ids))<>(select count(distinct x) from unnest(p_card_ids)x) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_duplicate='card_name' and (select count(*) from unnest(p_card_ids))<>(select count(distinct lower(btrim(c.name))) from unnest(p_card_ids)x join cards c on c.id=x) then raise exception 'MAKER_DUPLICATE_CARD_NAME'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||':'||p_session_id::text,0));
  if p_submission_id is not null then
    select id into v_id from maker_submissions where id=p_submission_id and project_id=p_project_id and creation_session_id=p_session_id and is_valid and ((p_user_id is not null and user_id=p_user_id) or (p_user_id is null and user_id is null and anonymous_edit_token_hash=p_edit_token_hash)) for update;
    if v_id is null then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
  else
    select id into v_id from maker_submissions where project_id=p_project_id and creation_session_id=p_session_id and is_valid and ((p_user_id is not null and user_id=p_user_id) or (p_user_id is null and user_id is null and anonymous_actor_hash=p_actor_hash)) for update;
  end if;
  if v_id is null then
    insert into maker_submissions(project_id,user_id,title,comment,is_valid,is_public,is_overwrite_slot,anonymous_edit_token_hash,anonymous_actor_hash,creation_session_id)
    values(p_project_id,p_user_id,btrim(p_title),nullif(btrim(p_comment),''),true,true,false,p_edit_token_hash,p_actor_hash,p_session_id) returning id into v_id;
  else update maker_submissions set title=btrim(p_title),comment=nullif(btrim(p_comment),''),updated_at=now() where id=v_id; delete from maker_submission_items where submission_id=v_id; end if;
  insert into maker_submission_items(submission_id,card_id,group_key,position,selection_order) select v_id,id,'selected',ordinality-1,ordinality-1 from unnest(p_card_ids) with ordinality x(id,ordinality);
  return v_id;
end $$;
revoke all on function public.upsert_select_maker_submission(uuid,uuid,text,text,uuid,uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.upsert_select_maker_submission(uuid,uuid,text,text,uuid,uuid,text,text,uuid[]) to service_role;

create or replace view public.maker_select_aggregates as
select s.project_id,i.card_id,c.name,count(distinct s.id)::int selection_count,
  count(distinct s.id) filter(where i.position=floor((sc.item_count-1)/2.0))::int center_count,
  count(distinct s.id)::numeric/nullif(t.submission_count,0) selection_rate
from maker_submissions s join maker_submission_items i on i.submission_id=s.id and i.group_key='selected' join cards c on c.id=i.card_id
join (select submission_id,count(*) item_count from maker_submission_items where group_key='selected' group by submission_id) sc on sc.submission_id=s.id
join (select project_id,count(*)::numeric submission_count from maker_submissions where is_valid and is_public group by project_id) t on t.project_id=s.project_id
where s.is_valid and s.is_public group by s.project_id,i.card_id,c.name,t.submission_count,sc.item_count;
revoke all on public.maker_select_aggregates from anon,authenticated;

insert into public.maker_projects(slug,title,type,status,is_public,config) values
('my-duema-9','あなたを象徴するデュエマカード9選','select','published',true,'{"description":"あなた自身を象徴するデュエマカードを9枚選んで、3×3の画像を作ろう。","minChoices":9,"maxChoices":9,"exactChoices":true,"reorderable":true,"duplicateRule":"card_name","cardPool":"all","resultTitle":"あなたを象徴するデュエマカード9選","showTitle":true,"showComment":true,"defaultTitle":"私を象徴する9枚","defaultComment":"","showSubmissions":true,"showAggregates":true,"showZeroVotes":false,"autoRegisterOnImageSave":true,"defaultListPublic":true,"shareText":"私を象徴するデュエマカード9選を作りました！\n\nあなたを象徴する9枚も作ってみよう！","hashtag":"#デュエマ","allowAnonymousSubmission":true}'::jsonb),
('favorite-cards-5-preview','好きなカード5選','select','draft',false,'{"minChoices":5,"maxChoices":5,"exactChoices":true,"reorderable":true,"duplicateRule":"card_name","cardPool":"all","resultTitle":"好きなデュエマカード5選","defaultTitle":"好きなカード5選","showTitle":true,"showComment":true,"showSubmissions":true,"showAggregates":true,"autoRegisterOnImageSave":true,"defaultListPublic":true}'::jsonb),
('my-trump-card-preview','俺の切り札1枚','select','draft',false,'{"minChoices":1,"maxChoices":1,"exactChoices":true,"reorderable":false,"duplicateRule":"card_name","cardPool":"all","resultTitle":"俺の切り札1枚","defaultTitle":"俺の切り札","showTitle":true,"showComment":true,"showSubmissions":true,"showAggregates":true,"autoRegisterOnImageSave":true,"defaultListPublic":true}'::jsonb)
on conflict(slug) do update set title=excluded.title,type=excluded.type,status=excluded.status,is_public=excluded.is_public,config=excluded.config,updated_at=now();

commit;
