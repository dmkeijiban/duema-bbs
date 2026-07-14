-- 画像保存時の自動登録を、未ログインのTier表利用者にも許可する。
begin;

update public.maker_projects
set config=jsonb_set(config,'{allowAnonymousSubmission}','true'::jsonb,true),updated_at=now()
where slug='dm26-ex2-charisma-best-tier'
  and coalesce((config->>'allowAnonymousSubmission')::boolean,false)=false;

insert into supabase_migrations.schema_migrations(version,name)
values('20260715100000','enable_anonymous_tier_submissions')
on conflict(version) do nothing;

commit;
