create or replace function public.update_owned_maker_submission(p_project_id uuid,p_submission_id uuid,p_user_id uuid,p_title text,p_comment text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_config jsonb; v_groups text[]; v_allow_duplicates boolean; v_max_choices integer;
begin
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 then raise exception 'MAKER_TITLE_INVALID'; end if;
  if p_comment is not null and char_length(btrim(p_comment))>200 then raise exception 'MAKER_COMMENT_INVALID'; end if;
  select config into v_config from maker_projects where id=p_project_id and is_public and status='published' for update;
  if v_config is null then raise exception 'MAKER_PROJECT_NOT_PUBLISHED'; end if;
  if not exists(select 1 from maker_submissions where id=p_submission_id and project_id=p_project_id and user_id=p_user_id for update) then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
  select coalesce(array_agg(value->>'key'),array[]::text[]) into v_groups from jsonb_array_elements(coalesce(v_config->'groups','[]'::jsonb));
  v_allow_duplicates:=coalesce((v_config->>'allowDuplicates')::boolean,false); v_max_choices:=nullif(v_config->>'maxChoices','')::integer;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id where x.card_id is null or pc.card_id is null or not(x.group_key=any(v_groups)) or x.position is null or x.position<0) then raise exception 'MAKER_ITEMS_INVALID'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.group_key,x.position having count(*)>1) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.card_id having count(*)>1) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and jsonb_array_length(coalesce(p_items,'[]'))>v_max_choices then raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED'; end if;
  update maker_submissions set title=btrim(p_title),comment=nullif(btrim(p_comment),''),updated_at=now() where id=p_submission_id;
  delete from maker_submission_items where submission_id=p_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position) select p_submission_id,x.card_id,x.group_key,x.position from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
end $$;
revoke all on function public.update_owned_maker_submission(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_owned_maker_submission(uuid,uuid,uuid,text,text,jsonb) to service_role;

create or replace function public.delete_owned_maker_submission(p_project_id uuid,p_submission_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from maker_submissions where id=p_submission_id and project_id=p_project_id and user_id=p_user_id;
  if not found then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
end $$;
revoke all on function public.delete_owned_maker_submission(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_owned_maker_submission(uuid,uuid,uuid) to service_role;

create or replace view public.maker_tier_aggregates as
select p.id project_id,c.id card_id,c.name,
  count(*) filter(where i.group_key='s')::int s_count,count(*) filter(where i.group_key='a')::int a_count,
  count(*) filter(where i.group_key='b')::int b_count,count(*) filter(where i.group_key='c')::int c_count,
  count(*) filter(where i.group_key='d')::int d_count,count(distinct s.id)::int rating_count,
  avg(case i.group_key when 's' then 5 when 'a' then 4 when 'b' then 3 when 'c' then 2 when 'd' then 1 end)::numeric(5,2) average_tier
from maker_projects p join maker_submissions s on s.project_id=p.id and s.is_valid and s.is_public
join profiles profile on profile.id=s.user_id and not profile.profile_hidden and not profile.account_suspended and profile.withdrawn_at is null
join maker_submission_items i on i.submission_id=s.id join cards c on c.id=i.card_id
group by p.id,c.id,c.name;
revoke all on public.maker_tier_aggregates from anon,authenticated;
