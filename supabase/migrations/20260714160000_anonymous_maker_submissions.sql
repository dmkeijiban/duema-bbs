alter table public.maker_submissions alter column user_id drop not null;
alter table public.maker_submissions
  add column if not exists anonymous_edit_token_hash text,
  add column if not exists anonymous_actor_hash text;
alter table public.maker_submissions
  add constraint maker_submissions_anonymous_owner_check check (
    (user_id is not null and anonymous_edit_token_hash is null and anonymous_actor_hash is null)
    or (user_id is null and anonymous_edit_token_hash ~ '^[0-9a-f]{64}$' and anonymous_actor_hash ~ '^[0-9a-f]{64}$')
  );
create index if not exists maker_submissions_anonymous_actor_created_idx
  on public.maker_submissions(anonymous_actor_hash,created_at desc) where user_id is null;
create table public.maker_anonymous_submission_attempts (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.maker_projects(id) on delete cascade,
  actor_hash text not null check (actor_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index maker_anonymous_submission_attempts_actor_created_idx
  on public.maker_anonymous_submission_attempts(actor_hash,created_at desc);
alter table public.maker_anonymous_submission_attempts enable row level security;
revoke all on public.maker_anonymous_submission_attempts from public,anon,authenticated;
grant select,insert on public.maker_anonymous_submission_attempts to service_role;
update public.maker_projects set config=jsonb_set(config,'{allowAnonymousSubmission}','true'::jsonb,true)
where slug='dm26-ex2-charisma-best-tier';
create or replace function public.create_anonymous_maker_submission(p_project_id uuid,p_title text,p_comment text,p_items jsonb,p_edit_token_hash text,p_actor_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_config jsonb; v_groups text[]; v_allow_duplicates boolean; v_max_choices integer;
begin
  if p_edit_token_hash !~ '^[0-9a-f]{64}$' or p_actor_hash !~ '^[0-9a-f]{64}$' then raise exception 'MAKER_ANONYMOUS_OWNER_INVALID'; end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 then raise exception 'MAKER_TITLE_INVALID'; end if;
  if p_comment is not null and char_length(btrim(p_comment))>200 then raise exception 'MAKER_COMMENT_INVALID'; end if;
  select config into v_config from maker_projects where id=p_project_id and is_public and status='published' for update;
  if v_config is null or coalesce((v_config->>'allowAnonymousSubmission')::boolean,false)=false then raise exception 'MAKER_ANONYMOUS_NOT_ALLOWED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor_hash,0));
  delete from maker_anonymous_submission_attempts where actor_hash=p_actor_hash and created_at<=now()-interval '24 hours';
  if (select count(*) from maker_anonymous_submission_attempts where actor_hash=p_actor_hash and created_at>now()-interval '10 minutes')>=5
     or (select count(*) from maker_anonymous_submission_attempts where actor_hash=p_actor_hash and created_at>now()-interval '24 hours')>=20
  then raise exception 'MAKER_ANONYMOUS_RATE_LIMITED'; end if;
  insert into maker_anonymous_submission_attempts(project_id,actor_hash) values(p_project_id,p_actor_hash);
  select coalesce(array_agg(value->>'key'),array[]::text[]) into v_groups from jsonb_array_elements(coalesce(v_config->'groups','[]'::jsonb));
  if cardinality(v_groups)=0 then raise exception 'MAKER_CONFIG_GROUPS_INVALID'; end if;
  v_allow_duplicates:=coalesce((v_config->>'allowDuplicates')::boolean,false); v_max_choices:=nullif(v_config->>'maxChoices','')::integer;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id where x.card_id is null or pc.card_id is null or not(x.group_key=any(v_groups)) or x.position is null or x.position<0) then raise exception 'MAKER_ITEMS_INVALID'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.group_key,x.position having count(*)>1) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.card_id having count(*)>1) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and jsonb_array_length(coalesce(p_items,'[]'))>v_max_choices then raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED'; end if;
  insert into maker_submissions(project_id,user_id,title,comment,is_valid,is_public,is_overwrite_slot,anonymous_edit_token_hash,anonymous_actor_hash)
    values(p_project_id,null,btrim(p_title),nullif(btrim(p_comment),''),true,true,false,p_edit_token_hash,p_actor_hash) returning id into v_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position) select v_id,x.card_id,x.group_key,x.position from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
  return v_id;
end $$;
create or replace function public.update_anonymous_maker_submission(p_project_id uuid,p_submission_id uuid,p_edit_token_hash text,p_title text,p_comment text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_config jsonb; v_groups text[]; v_allow_duplicates boolean; v_max_choices integer;
begin
  if p_edit_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
  if nullif(btrim(p_title),'') is null or char_length(btrim(p_title))>40 then raise exception 'MAKER_TITLE_INVALID'; end if;
  if p_comment is not null and char_length(btrim(p_comment))>200 then raise exception 'MAKER_COMMENT_INVALID'; end if;
  select config into v_config from maker_projects where id=p_project_id and is_public and status='published' for update;
  if v_config is null or coalesce((v_config->>'allowAnonymousSubmission')::boolean,false)=false then raise exception 'MAKER_ANONYMOUS_NOT_ALLOWED'; end if;
  if not exists(select 1 from maker_submissions where id=p_submission_id and project_id=p_project_id and user_id is null and anonymous_edit_token_hash=p_edit_token_hash and is_valid and is_public for update) then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
  select coalesce(array_agg(value->>'key'),array[]::text[]) into v_groups from jsonb_array_elements(coalesce(v_config->'groups','[]'::jsonb));
  if cardinality(v_groups)=0 then raise exception 'MAKER_CONFIG_GROUPS_INVALID'; end if;
  v_allow_duplicates:=coalesce((v_config->>'allowDuplicates')::boolean,false); v_max_choices:=nullif(v_config->>'maxChoices','')::integer;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) left join maker_project_cards pc on pc.project_id=p_project_id and pc.card_id=x.card_id where x.card_id is null or pc.card_id is null or not(x.group_key=any(v_groups)) or x.position is null or x.position<0) then raise exception 'MAKER_ITEMS_INVALID'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.group_key,x.position having count(*)>1) then raise exception 'MAKER_DUPLICATE_POSITION'; end if;
  if not v_allow_duplicates and exists(select 1 from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer) group by x.card_id having count(*)>1) then raise exception 'MAKER_DUPLICATE_CARD'; end if;
  if v_max_choices is not null and jsonb_array_length(coalesce(p_items,'[]'))>v_max_choices then raise exception 'MAKER_CHOICE_LIMIT_EXCEEDED'; end if;
  update maker_submissions set title=btrim(p_title),comment=nullif(btrim(p_comment),''),updated_at=now() where id=p_submission_id;
  delete from maker_submission_items where submission_id=p_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position) select p_submission_id,x.card_id,x.group_key,x.position from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
end $$;
create or replace function public.delete_anonymous_maker_submission(p_project_id uuid,p_submission_id uuid,p_edit_token_hash text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from maker_projects where id=p_project_id and is_public and status='published' and coalesce((config->>'allowAnonymousSubmission')::boolean,false)) then raise exception 'MAKER_ANONYMOUS_NOT_ALLOWED'; end if;
  delete from maker_submissions where id=p_submission_id and project_id=p_project_id and user_id is null and anonymous_edit_token_hash=p_edit_token_hash and is_valid and is_public;
  if not found then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
end $$;
revoke all on function public.create_anonymous_maker_submission(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.update_anonymous_maker_submission(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.delete_anonymous_maker_submission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_anonymous_maker_submission(uuid,text,text,jsonb,text,text) to service_role;
grant execute on function public.update_anonymous_maker_submission(uuid,uuid,text,text,text,jsonb) to service_role;
grant execute on function public.delete_anonymous_maker_submission(uuid,uuid,text) to service_role;
create or replace view public.maker_tier_aggregates as
select p.id project_id,c.id card_id,c.name,
  count(*) filter(where i.group_key='s')::int s_count,count(*) filter(where i.group_key='a')::int a_count,
  count(*) filter(where i.group_key='b')::int b_count,count(*) filter(where i.group_key='c')::int c_count,
  count(*) filter(where i.group_key='d')::int d_count,count(distinct s.id)::int rating_count,
  avg(case i.group_key when 's' then 5 when 'a' then 4 when 'b' then 3 when 'c' then 2 when 'd' then 1 end)::numeric(5,2) average_tier
from maker_projects p join maker_submissions s on s.project_id=p.id and s.is_valid and s.is_public
left join profiles profile on profile.id=s.user_id
join maker_submission_items i on i.submission_id=s.id join cards c on c.id=i.card_id
where s.user_id is null or (profile.id is not null and not profile.profile_hidden and not profile.account_suspended and profile.withdrawn_at is null)
group by p.id,c.id,c.name;
revoke all on public.maker_tier_aggregates from anon,authenticated;
