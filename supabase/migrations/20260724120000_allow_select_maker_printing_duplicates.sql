begin;

create or replace function public.upsert_select_maker_submission(
  p_project_id uuid,p_user_id uuid,p_edit_token_hash text,p_actor_hash text,p_session_id uuid,p_submission_id uuid,p_title text,p_comment text,
  p_card_ids uuid[],p_source_keys text[] default null,p_face_side_indexes integer[] default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_config jsonb; v_min int; v_max int; v_exact bool; v_pool text;
begin
  select config into v_config from maker_projects where id=p_project_id and type='select' and status='published' and is_public for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_PUBLISHED'; end if;
  v_min:=coalesce((v_config->>'minChoices')::int,1); v_max:=coalesce((v_config->>'maxChoices')::int,12);
  v_exact:=coalesce((v_config->>'exactChoices')::bool,true); v_pool:=coalesce(v_config->>'cardPool','all');
  if p_card_ids is null or cardinality(p_card_ids)<v_min or cardinality(p_card_ids)>v_max or (v_exact and cardinality(p_card_ids)<>v_max) then raise exception 'MAKER_CHOICE_COUNT_INVALID'; end if;
  if p_source_keys is not null and cardinality(p_source_keys)<>cardinality(p_card_ids) then raise exception 'MAKER_PRINTING_ARRAY_INVALID'; end if;
  if p_face_side_indexes is not null and cardinality(p_face_side_indexes)<>cardinality(p_card_ids) then raise exception 'MAKER_PRINTING_ARRAY_INVALID'; end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 or (p_comment is not null and char_length(btrim(p_comment))>200) then raise exception 'MAKER_META_INVALID'; end if;
  if (p_user_id is null)=(p_edit_token_hash is null) then raise exception 'MAKER_OWNER_INVALID'; end if;
  if p_user_id is null and (p_edit_token_hash !~ '^[0-9a-f]{64}$' or p_actor_hash !~ '^[0-9a-f]{64}$') then raise exception 'MAKER_OWNER_INVALID'; end if;
  if exists(select 1 from unnest(p_card_ids) x(id) left join cards c on c.id=x.id and c.is_active where c.id is null) then raise exception 'MAKER_CARD_INVALID'; end if;
  if v_pool='manual' and exists(select 1 from unnest(p_card_ids) x(id) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.id where pc.card_id is null) then raise exception 'MAKER_CARD_OUTSIDE_POOL'; end if;

  -- 同名カード・同一card_idでも、収録版(source_key)または面が違えば別カードとして許可する。
  -- 完全に同じ収録版・同じ面の重複だけを拒否する。
  if exists (
    select 1
    from (
      select c.id, coalesce(k.source_key, ''), coalesce(f.face_side_index, -1), count(*)
      from unnest(p_card_ids) with ordinality c(id,ord)
      left join unnest(coalesce(p_source_keys,array[]::text[])) with ordinality k(source_key,ord) on k.ord=c.ord
      left join unnest(coalesce(p_face_side_indexes,array[]::integer[])) with ordinality f(face_side_index,ord) on f.ord=c.ord
      group by c.id, coalesce(k.source_key, ''), coalesce(f.face_side_index, -1)
      having count(*) > 1
    ) duplicates
  ) then raise exception 'MAKER_DUPLICATE_PRINTING'; end if;

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
