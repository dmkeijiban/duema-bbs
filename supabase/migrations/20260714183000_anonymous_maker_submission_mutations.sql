-- 匿名maker投稿を、登録時と同じ端末の編集用トークンでのみ更新・削除できるようにする。

create or replace function public.update_anonymous_maker_submission(
  p_project_id uuid,
  p_submission_id uuid,
  p_edit_token_hash text,
  p_title text,
  p_comment text,
  p_items jsonb
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_config jsonb;
  v_groups text[];
  v_allow_duplicates boolean;
  v_max_choices integer;
  v_item_count integer;
begin
  if p_edit_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'MAKER_ANONYMOUS_OWNER_INVALID';
  end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 then
    raise exception 'MAKER_TITLE_INVALID';
  end if;
  if p_comment is not null and char_length(btrim(p_comment))>200 then
    raise exception 'MAKER_COMMENT_INVALID';
  end if;

  select config into v_config
  from maker_projects
  where id=p_project_id and is_public and status='published'
  for update;
  if v_config is null or coalesce((v_config->>'allowAnonymousSubmission')::boolean,false)=false then
    raise exception 'MAKER_PROJECT_NOT_PUBLISHED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_edit_token_hash,0));
  if not exists(
    select 1 from maker_submissions
    where id=p_submission_id
      and project_id=p_project_id
      and user_id is null
      and anonymous_edit_token_hash=p_edit_token_hash
      and is_valid and is_public
    for update
  ) then
    raise exception 'MAKER_SUBMISSION_FORBIDDEN';
  end if;

  select coalesce(array_agg(value->>'key'),array[]::text[]) into v_groups
  from jsonb_array_elements(coalesce(v_config->'groups','[]'::jsonb));
  v_allow_duplicates:=coalesce((v_config->>'allowDuplicates')::boolean,false);
  v_max_choices:=nullif(v_config->>'maxChoices','')::integer;
  v_item_count:=jsonb_array_length(coalesce(p_items,'[]'::jsonb));

  if v_item_count=0 then raise exception 'MAKER_EMPTY_SUBMISSION'; end if;
  if exists(
    select 1
    from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id
    left join cards c on c.id=x.card_id and c.is_active
    where x.card_id is null
      or pc.card_id is null
      or c.id is null
      or x.group_key is null
      or not(x.group_key=any(v_groups))
      or x.position is null
      or x.position<0
  ) then raise exception 'MAKER_ITEMS_INVALID'; end if;
  if exists(
    select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.group_key,x.position having count(*)>1
  ) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists(
    select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.card_id having count(*)>1
  ) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and v_item_count>v_max_choices then
    raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED';
  end if;

  update maker_submissions
  set title=btrim(p_title),comment=nullif(btrim(p_comment),''),updated_at=now()
  where id=p_submission_id;
  delete from maker_submission_items where submission_id=p_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position)
  select p_submission_id,x.card_id,x.group_key,x.position
  from jsonb_to_recordset(p_items) x(card_id uuid,group_key text,position integer);
end
$$;

revoke all on function public.update_anonymous_maker_submission(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_anonymous_maker_submission(uuid,uuid,text,text,text,jsonb) to service_role;

create or replace function public.delete_anonymous_maker_submission(
  p_project_id uuid,
  p_submission_id uuid,
  p_edit_token_hash text
) returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_edit_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'MAKER_ANONYMOUS_OWNER_INVALID';
  end if;
  if not exists(
    select 1 from maker_projects
    where id=p_project_id and is_public and status='published'
  ) then
    raise exception 'MAKER_PROJECT_NOT_PUBLISHED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_edit_token_hash,0));
  delete from maker_submissions
  where id=p_submission_id
    and project_id=p_project_id
    and user_id is null
    and anonymous_edit_token_hash=p_edit_token_hash
    and is_valid and is_public;
  if not found then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
end
$$;

revoke all on function public.delete_anonymous_maker_submission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.delete_anonymous_maker_submission(uuid,uuid,text) to service_role;
