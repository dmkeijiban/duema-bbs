-- 参加型カード選択企画（例: my-duema-9）で、保存時に選んだ収録版(source_key)と
-- 両面カードの面(face_side_index)を維持できるよう maker_submission_items へ列を追加する。
-- 既存行は source_key / face_side_index が null のままとなり、読み込み側は
-- card_id からの代表画像フォールバックを維持する（後方互換）。
-- デッキメーカー（DeckCard.sourceKey / matchedFace.sideIndex）と同じ識別子を再利用する。

begin;

alter table public.maker_submission_items add column if not exists source_key text;
alter table public.maker_submission_items add column if not exists face_side_index integer;

drop function if exists public.upsert_select_maker_submission(uuid,uuid,text,text,uuid,uuid,text,text,uuid[]);

create or replace function public.upsert_select_maker_submission(
  p_project_id uuid,p_user_id uuid,p_edit_token_hash text,p_actor_hash text,p_session_id uuid,p_submission_id uuid,p_title text,p_comment text,
  p_card_ids uuid[],p_source_keys text[] default null,p_face_side_indexes integer[] default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_config jsonb; v_min int; v_max int; v_exact bool; v_pool text; v_duplicate text;
begin
  select config into v_config from maker_projects where id=p_project_id and type='select' and status='published' and is_public for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_PUBLISHED'; end if;
  v_min:=coalesce((v_config->>'minChoices')::int,1); v_max:=coalesce((v_config->>'maxChoices')::int,12);
  v_exact:=coalesce((v_config->>'exactChoices')::bool,true); v_pool:=coalesce(v_config->>'cardPool','all'); v_duplicate:=coalesce(v_config->>'duplicateRule','card_name');
  if p_card_ids is null or cardinality(p_card_ids)<v_min or cardinality(p_card_ids)>v_max or (v_exact and cardinality(p_card_ids)<>v_max) then raise exception 'MAKER_CHOICE_COUNT_INVALID'; end if;
  if p_source_keys is not null and cardinality(p_source_keys)<>cardinality(p_card_ids) then raise exception 'MAKER_PRINTING_ARRAY_INVALID'; end if;
  if p_face_side_indexes is not null and cardinality(p_face_side_indexes)<>cardinality(p_card_ids) then raise exception 'MAKER_PRINTING_ARRAY_INVALID'; end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 or (p_comment is not null and char_length(btrim(p_comment))>200) then raise exception 'MAKER_META_INVALID'; end if;
  if (p_user_id is null)=(p_edit_token_hash is null) then raise exception 'MAKER_OWNER_INVALID'; end if;
  if p_user_id is null and (p_edit_token_hash !~ '^[0-9a-f]{64}$' or p_actor_hash !~ '^[0-9a-f]{64}$') then raise exception 'MAKER_OWNER_INVALID'; end if;
  if exists(select 1 from unnest(p_card_ids) x(id) left join cards c on c.id=x.id and c.is_active where c.id is null) then raise exception 'MAKER_CARD_INVALID'; end if;
  if v_pool='manual' and exists(select 1 from unnest(p_card_ids) x(id) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.id where pc.card_id is null) then raise exception 'MAKER_CARD_OUTSIDE_POOL'; end if;
  if v_duplicate='card_id' and (select count(*) from unnest(p_card_ids))<>(select count(distinct x) from unnest(p_card_ids)x) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_duplicate='card_name' and (select count(*) from unnest(p_card_ids))<>(select count(distinct lower(btrim(c.name))) from unnest(p_card_ids)x join cards c on c.id=x) then raise exception 'MAKER_DUPLICATE_CARD_NAME'; end if;
  if p_source_keys is not null and exists(
    select 1 from unnest(p_card_ids) with ordinality c(id,ord)
    join unnest(p_source_keys) with ordinality k(source_key,ord) on k.ord=c.ord
    where k.source_key is not null and not exists(select 1 from card_printings cp where cp.card_id=c.id and cp.source_key=k.source_key)
  ) then raise exception 'MAKER_PRINTING_INVALID'; end if;
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
  insert into maker_submission_items(submission_id,card_id,group_key,position,selection_order,source_key,face_side_index)
  select v_id,c.id,'selected',c.ord-1,c.ord-1,k.source_key,f.face_side_index
  from unnest(p_card_ids) with ordinality c(id,ord)
  left join unnest(coalesce(p_source_keys,array[]::text[])) with ordinality k(source_key,ord) on k.ord=c.ord
  left join unnest(coalesce(p_face_side_indexes,array[]::integer[])) with ordinality f(face_side_index,ord) on f.ord=c.ord;
  return v_id;
end $$;
revoke all on function public.upsert_select_maker_submission(uuid,uuid,text,text,uuid,uuid,text,text,uuid[],text[],integer[]) from public,anon,authenticated;
grant execute on function public.upsert_select_maker_submission(uuid,uuid,text,text,uuid,uuid,text,text,uuid[],text[],integer[]) to service_role;

commit;
