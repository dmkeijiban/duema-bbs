-- Review only: productionへはこのPRから適用しない。
alter table public.maker_submissions
  add column if not exists title text,
  add column if not exists comment text,
  add column if not exists thumbnail_url text,
  add column if not exists is_public boolean not null default true,
  add column if not exists is_overwrite_slot boolean not null default true;

update public.maker_submissions
set title = coalesce(nullif(title, ''), '登録作品')
where title is null;

alter table public.maker_submissions
  alter column title set default '登録作品',
  alter column title set not null;

alter table public.maker_submissions
  drop constraint if exists maker_submissions_project_id_user_id_key;

create unique index if not exists maker_submissions_overwrite_slot_key
  on public.maker_submissions(project_id,user_id)
  where is_overwrite_slot = true;

alter table public.maker_submissions
  drop constraint if exists maker_submissions_title_length,
  add constraint maker_submissions_title_length check (char_length(title) between 1 and 40),
  drop constraint if exists maker_submissions_comment_length,
  add constraint maker_submissions_comment_length check (comment is null or char_length(comment) <= 200);

create index if not exists maker_submissions_public_newest_idx
  on public.maker_submissions(project_id, created_at desc)
  where is_public = true and is_valid = true;

create or replace function public.create_maker_submission(
  p_project_id uuid,
  p_user_id uuid,
  p_title text,
  p_comment text,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_submission_id uuid;
  v_config jsonb;
  v_allowed_groups text[];
  v_allow_duplicates boolean;
  v_max_choices integer;
begin
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 40 then raise exception 'MAKER_TITLE_INVALID'; end if;
  if p_comment is not null and char_length(btrim(p_comment)) > 200 then raise exception 'MAKER_COMMENT_INVALID'; end if;

  select config into v_config from maker_projects
  where id = p_project_id and status = 'published' and is_public = true for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_PUBLISHED'; end if;

  select coalesce(array_agg(value->>'key'), array[]::text[]) into v_allowed_groups
  from jsonb_array_elements(coalesce(v_config->'groups', '[]'::jsonb));
  if cardinality(v_allowed_groups) = 0 then raise exception 'MAKER_CONFIG_GROUPS_INVALID'; end if;
  v_allow_duplicates := coalesce((v_config->>'allowDuplicates')::boolean, false);
  v_max_choices := nullif(v_config->>'maxChoices', '')::integer;

  if exists (select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id
    where x.card_id is null or pc.card_id is null or x.group_key is null or not (x.group_key=any(v_allowed_groups)) or x.position is null or x.position < 0)
  then raise exception 'MAKER_ITEMS_INVALID'; end if;
  if exists (select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.group_key,x.position having count(*)>1) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists (select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.card_id having count(*)>1) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and jsonb_array_length(coalesce(p_items,'[]')) > v_max_choices then raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED'; end if;

  insert into maker_submissions(project_id,user_id,title,comment,is_valid,is_public,is_overwrite_slot)
  values(p_project_id,p_user_id,btrim(p_title),nullif(btrim(p_comment),''),true,true,false)
  returning id into v_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position)
  select v_submission_id,x.card_id,x.group_key,x.position
  from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
  return v_submission_id;
end $$;

revoke all on function public.create_maker_submission(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_maker_submission(uuid,uuid,text,text,jsonb) to service_role;

-- 既存メーカーの「回答を更新」は専用slotだけを更新し、新規作品を上書きしない。
create or replace function public.save_maker_submission(
  p_project_id uuid, p_user_id uuid, p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_submission_id uuid; v_config jsonb; v_allowed_groups text[];
  v_allow_duplicates boolean; v_max_choices integer; v_item_count integer;
begin
  select config into v_config from maker_projects where id=p_project_id for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_FOUND'; end if;
  select coalesce(array_agg(value->>'key'),array[]::text[]) into v_allowed_groups
    from jsonb_array_elements(coalesce(v_config->'groups','[]'::jsonb));
  if cardinality(v_allowed_groups)=0 then raise exception 'MAKER_CONFIG_GROUPS_INVALID'; end if;
  v_allow_duplicates:=coalesce((v_config->>'allowDuplicates')::boolean,false);
  v_max_choices:=nullif(v_config->>'maxChoices','')::integer;
  v_item_count:=jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    where x.group_key is null or not(x.group_key=any(v_allowed_groups))) then raise exception 'MAKER_INVALID_GROUP_KEY'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id
    where x.card_id is null or pc.card_id is null) then raise exception 'MAKER_CARD_OUTSIDE_POOL'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    where x.position is null or x.position<0) then raise exception 'MAKER_INVALID_POSITION'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.group_key,x.position having count(*)>1) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer)
    group by x.card_id having count(*)>1) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and v_item_count>v_max_choices then raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED'; end if;

  select id into v_submission_id from maker_submissions
    where project_id=p_project_id and user_id=p_user_id and is_overwrite_slot=true for update;
  if v_submission_id is null then
    insert into maker_submissions(project_id,user_id,title,is_valid,is_public,is_overwrite_slot,updated_at)
      values(p_project_id,p_user_id,'登録作品',true,true,true,now()) returning id into v_submission_id;
  else
    update maker_submissions set is_valid=true,updated_at=now() where id=v_submission_id;
  end if;
  delete from maker_submission_items where submission_id=v_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position)
    select v_submission_id,x.card_id,x.group_key,x.position
    from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
  return v_submission_id;
end $$;
revoke all on function public.save_maker_submission(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_maker_submission(uuid,uuid,jsonb) to service_role;

-- 複数作品を集計対象にするため、割合の分母もユーザー数ではなく作品数に揃える。
create or replace view public.maker_tier_aggregates as
select p.id project_id, c.id card_id, c.name,
  count(*) filter(where i.group_key='s')::int s_count,
  count(*) filter(where i.group_key='a')::int a_count,
  count(*) filter(where i.group_key='b')::int b_count,
  count(*) filter(where i.group_key='c')::int c_count,
  count(*) filter(where i.group_key='d')::int d_count,
  count(distinct s.id)::int rating_count,
  avg(case i.group_key when 's' then 5 when 'a' then 4 when 'b' then 3 when 'c' then 2 when 'd' then 1 end)::numeric(5,2) average_tier
from public.maker_projects p
join public.maker_submissions s on s.project_id=p.id and s.is_valid
join public.maker_submission_items i on i.submission_id=s.id
join public.cards c on c.id=i.card_id
group by p.id,c.id,c.name;

revoke all on public.maker_tier_aggregates from anon, authenticated;
