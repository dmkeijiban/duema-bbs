-- Review only: productionへはこのPRから適用しない。
alter table public.maker_submissions
  add column if not exists title text,
  add column if not exists comment text,
  add column if not exists thumbnail_url text,
  add column if not exists is_public boolean not null default true;

update public.maker_submissions
set title = coalesce(nullif(title, ''), '登録作品')
where title is null;

alter table public.maker_submissions
  alter column title set not null;

alter table public.maker_submissions
  drop constraint if exists maker_submissions_project_id_user_id_key;

alter table public.maker_submissions
  drop constraint if exists maker_submissions_title_length,
  add constraint maker_submissions_title_length check (char_length(title) between 1 and 40),
  drop constraint if exists maker_submissions_comment_length,
  add constraint maker_submissions_comment_length check (comment is null or char_length(comment) <= 200);

create index if not exists maker_submissions_public_newest_idx
  on public.maker_submissions(project_id, created_at desc)
  where is_public = true and is_valid = true;

alter table public.maker_events drop constraint if exists maker_events_event_type_check;
alter table public.maker_events add constraint maker_events_event_type_check check (
  event_type in ('tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup','submissions_view','submission_detail_view','submission_create')
);

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

  insert into maker_submissions(project_id,user_id,title,comment,is_valid,is_public)
  values(p_project_id,p_user_id,btrim(p_title),nullif(btrim(p_comment),''),true,true)
  returning id into v_submission_id;
  insert into maker_submission_items(submission_id,card_id,group_key,position)
  select v_submission_id,x.card_id,x.group_key,x.position
  from jsonb_to_recordset(coalesce(p_items,'[]')) x(card_id uuid,group_key text,position integer);
  return v_submission_id;
end $$;

revoke all on function public.create_maker_submission(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_maker_submission(uuid,uuid,text,text,jsonb) to service_role;
