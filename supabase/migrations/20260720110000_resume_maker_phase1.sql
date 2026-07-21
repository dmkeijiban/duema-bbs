-- デュエマ履歴書メーカー（/makers/resume-maker）。既存メーカー基盤(maker_projects/maker_submissions)を
-- 最小拡張する。履歴書本体は構造化データ(resume_data jsonb)を正本とし、PNG画像は保存しない。
-- 1ユーザー1履歴書は、既存の is_overwrite_slot 部分ユニークインデックス(project_id,user_id)を再利用して担保する。
-- 読み取りは既存パターンと同じくRLSポリシーを追加せず、service_role(サーバー側admin client)のみに限定する。

begin;

alter table public.maker_projects drop constraint if exists maker_projects_type_check;
alter table public.maker_projects add constraint maker_projects_type_check check(type=any(array['tier','prediction','selection','select','resume']));

alter table public.maker_submissions
  add column if not exists resume_data jsonb,
  add column if not exists photo_card_id uuid references public.cards(id) on delete set null;

alter table public.maker_submissions
  drop constraint if exists maker_submissions_resume_data_size,
  add constraint maker_submissions_resume_data_size check (resume_data is null or pg_column_size(resume_data) < 20000);

insert into public.maker_projects(slug,title,type,status,is_public,config) values
('resume-maker','デュエマ履歴書','resume','published',true,'{"description":"あなたのデュエマ歴を、本物の履歴書風にまとめよう。","shareText":"デュエマ履歴書を書きました","hashtag":"#デュエマ履歴書"}'::jsonb)
on conflict(slug) do nothing;

create or replace function public.upsert_resume_maker_submission(
  p_project_id uuid, p_user_id uuid, p_resume_data jsonb, p_photo_card_id uuid, p_is_public boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_project record;
  v_handle_name text;
  v_id uuid;
begin
  if p_user_id is null then raise exception 'MAKER_OWNER_INVALID'; end if;
  select id,type,status,is_public into v_project from maker_projects where id=p_project_id for update;
  if v_project.id is null or v_project.type<>'resume' or v_project.status<>'published' or not v_project.is_public then
    raise exception 'MAKER_PROJECT_NOT_PUBLISHED';
  end if;
  if p_resume_data is null or jsonb_typeof(p_resume_data)<>'object' then raise exception 'MAKER_RESUME_DATA_INVALID'; end if;
  if pg_column_size(p_resume_data)>=20000 then raise exception 'MAKER_RESUME_DATA_TOO_LARGE'; end if;
  v_handle_name := nullif(btrim(p_resume_data->>'handleName'),'');
  if v_handle_name is null or char_length(v_handle_name)>30 then raise exception 'MAKER_RESUME_HANDLE_NAME_INVALID'; end if;
  if p_photo_card_id is not null and not exists(select 1 from cards where id=p_photo_card_id and is_active) then
    raise exception 'MAKER_CARD_INVALID';
  end if;

  select id into v_id from maker_submissions where project_id=p_project_id and user_id=p_user_id and is_overwrite_slot=true for update;
  if v_id is null then
    insert into maker_submissions(project_id,user_id,title,is_valid,is_public,is_overwrite_slot,resume_data,photo_card_id,updated_at)
    values(p_project_id,p_user_id,left(v_handle_name,40),true,coalesce(p_is_public,true),true,p_resume_data,p_photo_card_id,now())
    returning id into v_id;
  else
    update maker_submissions
    set title=left(v_handle_name,40),is_valid=true,is_public=coalesce(p_is_public,is_public),resume_data=p_resume_data,photo_card_id=p_photo_card_id,updated_at=now()
    where id=v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.upsert_resume_maker_submission(uuid,uuid,jsonb,uuid,boolean) from public,anon,authenticated;
grant execute on function public.upsert_resume_maker_submission(uuid,uuid,jsonb,uuid,boolean) to service_role;

-- 投稿者ページ・マイページからの公開/非公開の切り替え専用の薄いラッパー。resume_dataは変更しない。
create or replace function public.set_resume_maker_visibility(
  p_project_id uuid, p_user_id uuid, p_is_public boolean
) returns void language plpgsql security definer set search_path=public as $$
begin
  update maker_submissions set is_public=p_is_public, updated_at=now()
  where project_id=p_project_id and user_id=p_user_id and is_overwrite_slot=true and is_valid;
  if not found then raise exception 'MAKER_SUBMISSION_FORBIDDEN'; end if;
end $$;
revoke all on function public.set_resume_maker_visibility(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_resume_maker_visibility(uuid,uuid,boolean) to service_role;

commit;
